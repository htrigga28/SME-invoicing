import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, promises as fs, readdirSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import type { ConfigService } from "@nestjs/config";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";

import { DatabaseService, type AppDatabase } from "../database/database.service";
import * as schema from "../database/schema";

const execFileAsync = promisify(execFile);

export type TestPostgres = {
  connectionString: string;
  stop: () => Promise<void>;
};

async function findFreePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();

  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Could not allocate a free port for the test database.");
  }

  const port = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

export function embeddedPostgresPlatform(platform: string = process.platform): string {
  return platform === "win32" ? "windows" : platform;
}

function binaryDir(): string {
  // The embedded-postgres package exposes an exports-only entry point, so
  // resolve its platform binaries by scanning pnpm's content-addressable
  // store instead of relying on subpath resolution.
  // Package names follow Node's platform naming: darwin (not macos) on Apple
  // hardware, matching @embedded-postgres/darwin-arm64 in the lockfile.
  const platform = embeddedPostgresPlatform();
  const arch = process.arch === "arm64" ? "arm64" : "x64";
  const storeDirs: string[] = [];
  let cursor = __dirname;

  for (let depth = 0; depth < 8; depth += 1) {
    storeDirs.push(path.join(cursor, "node_modules", ".pnpm"));
    cursor = path.dirname(cursor);
  }

  for (const storeDir of storeDirs) {
    let entries: string[];

    try {
      entries = readdirSync(storeDir);
    } catch {
      continue;
    }

    const roots = entries.filter((entry) => entry.includes("embedded-postgres"));

    for (const root of roots) {
      for (const candidate of [
        `@embedded-postgres/${platform}-${arch}`,
        `@embedded-postgres/${platform}-x64`,
        `@embedded-postgres/${platform}-x86_64`,
        `@embedded-postgres/${platform}`
      ]) {
        const candidateDir = path.join(
          storeDir,
          root,
          "node_modules",
          ...candidate.split("/")
        );

        if (existsSync(path.join(candidateDir, "package.json"))) {
          return path.join(candidateDir, "native", "bin");
        }
      }
    }
  }

  throw new Error(
    `Embedded Postgres binaries were not found for ${process.platform}/${process.arch}.`
  );
}

function binary(name: string): string {
  return path.join(binaryDir(), process.platform === "win32" ? `${name}.exe` : name);
}

async function waitForReady(connectionString: string, attempts = 30): Promise<void> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const client = new Client({ connectionString, connectionTimeoutMillis: 5000 });

    try {
      await client.connect();
      await client.query("select 1");
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error(`Test Postgres did not become ready: ${String(lastError)}`);
}

/**
 * Runs a Postgres control binary without inheriting stdio pipes: pg_ctl start
 * daemonizes the server, and any inherited pipe would keep Node waiting
 * forever for EOF, so stdio must be ignored.
 */
function runControlBinary(file: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: "ignore" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${path.basename(file)} exited with code ${code}.`));
      }
    });
  });
}

/**
 * Starts a real PostgreSQL instance from the pre-bundled embedded-postgres
 * binaries and applies every migration in apps/api/drizzle. Used for
 * concurrency tests that must prove database-level guarantees (conditional
 * updates, idempotent inserts) rather than mocked-query behavior.
 */
export async function startTestPostgres(): Promise<TestPostgres> {
  const databaseDir = await fs.mkdtemp(path.join(os.tmpdir(), "lumina-test-pg-"));
  const port = await findFreePort();

  try {
    await execFileAsync(binary("initdb"), ["-D", databaseDir, "-U", "postgres", "--auth=trust"]);
    await runControlBinary(binary("pg_ctl"), [
      "-D",
      databaseDir,
      "-o",
      `-p ${port} -c listen_addresses=127.0.0.1`,
      "-l",
      path.join(databaseDir, "server.log"),
      "-w",
      "-t",
      "60",
      "start"
    ]);

    const connectionString = `postgresql://postgres@127.0.0.1:${port}/postgres`;
    await waitForReady(connectionString);
    const pool = new Pool({ connectionString, connectionTimeoutMillis: 10000 });
    const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../drizzle") });
    await pool.end();

    return {
      connectionString,
      stop: async () => {
        await runControlBinary(binary("pg_ctl"), [
          "-D",
          databaseDir,
          "-m",
          "fast",
          "stop"
        ]).catch(() => undefined);
        await fs.rm(databaseDir, { recursive: true, force: true });
      }
    };
  } catch (error) {
    await runControlBinary(binary("pg_ctl"), ["-D", databaseDir, "-m", "fast", "stop"]).catch(
      () => undefined
    );
    await fs.rm(databaseDir, { recursive: true, force: true });
    throw error;
  }
}

export function uniqueSlug(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}

export function requiredRow<T>(rows: T[], what: string): T {
  const [row] = rows;

  if (!row) {
    throw new Error(`Test fixture was not created: ${what}.`);
  }

  return row;
}

export type ApiTestPool = {
  connectionString: string;
  db: AppDatabase;
  databaseService: () => DatabaseService;
  stop: () => Promise<void>;
};

/**
 * Starts one embedded-Postgres pool for a real-database concurrency spec and
 * hands out DatabaseService instances backed by independent pools, matching
 * how production requests arrive on separate connections. Every spec that
 * proves a cross-connection invariant shares this harness so the pool,
 * teardown, and service-factory code is written once.
 */
export async function startApiTestPool(): Promise<ApiTestPool> {
  const postgres = await startTestPostgres();
  const connectionString = postgres.connectionString;
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 10000 });
  const db: AppDatabase = drizzle(pool, { schema });
  const databaseServices: DatabaseService[] = [];
  const databaseService = () => {
    const service = new DatabaseService({
      get: (key: string) => (key === "DATABASE_URL" ? connectionString : undefined)
    } as unknown as ConfigService);
    databaseServices.push(service);
    return service;
  };

  return {
    connectionString,
    db,
    databaseService,
    stop: async () => {
      for (const service of databaseServices) {
        await service.onModuleDestroy().catch(() => undefined);
      }
      await pool.end();
      await postgres.stop();
    }
  };
}
