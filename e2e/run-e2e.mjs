import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const adminDatabaseUrl = process.env.E2E_ADMIN_DATABASE_URL;
const requestedDatabaseUrl = process.env.E2E_DATABASE_URL;
const psqlCommand = process.env.E2E_PSQL_BIN ?? (process.platform === "win32"
  ? "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe"
  : "psql");

if (!adminDatabaseUrl) {
  throw new Error("E2E_ADMIN_DATABASE_URL is required so the runner can drop only its unique database.");
}

const databaseName = requestedDatabaseUrl
  ? new URL(requestedDatabaseUrl).pathname.slice(1)
  : `sme_invoicing_e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
if (!/^sme_invoicing_e2e_[a-z0-9_]+$/.test(databaseName)) {
  throw new Error("E2E_DATABASE_URL must target a uniquely named sme_invoicing_e2e_* database.");
}
const databaseUrl = requestedDatabaseUrl
  ? requestedDatabaseUrl
  : (() => {
      const url = new URL(adminDatabaseUrl);
      url.pathname = `/${databaseName}`;
      return url.toString();
    })();

const env = {
  ...process.env,
  NODE_ENV: "development",
  DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl,
  ALLOW_DEMO_SEED: "true",
  PORT: "4100",
  FRONTEND_APP_URL: "http://localhost:3100",
  CORS_ORIGINS: "http://localhost:3100,http://localhost:3102",
  NEXT_PUBLIC_API_URL: "http://localhost:4100",
  NEXT_PUBLIC_APP_URL: "http://localhost:3100",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3102",
  E2E_API_URL: "http://localhost:4100",
  E2E_APP_URL: "http://localhost:3100",
  E2E_SITE_URL: "http://localhost:3102"
};

const logDir = path.join(root, ".e2e-logs");
await mkdir(logDir, { recursive: true });
const children = [];

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });
    let output = "";
    child.stdout?.on("data", (chunk) => { output += chunk; });
    child.stderr?.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(output);
        return;
      }
      const safeArgs = args.map((arg) => {
        if (!arg.includes("://")) return arg;
        try {
          const url = new URL(arg);
          url.password = url.password ? "[redacted]" : "";
          return url.toString();
        } catch {
          return "[redacted-url]";
        }
      });
      reject(new Error(`${command} ${safeArgs.join(" ")} exited ${code}\n${output}`));
    });
  });
}

function start(command, args, name) {
  const child = spawn(command, args, {
    cwd: root,
    env,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const log = [];
  child.stdout?.on("data", (chunk) => log.push(chunk.toString()));
  child.stderr?.on("data", (chunk) => log.push(chunk.toString()));
  children.push({ child, name, log });
}

async function waitFor(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function teardown() {
  await mkdir(logDir, { recursive: true });
  for (const { child, name, log } of children) {
    if (!child.killed && process.platform === "win32") {
      await run("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }).catch(() => undefined);
    } else if (!child.killed) {
      child.kill("SIGTERM");
    }
    await writeFile(path.join(logDir, `${name}.log`), log.join(""), "utf8");
  }
  await run(psqlCommand, [adminDatabaseUrl, "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS ${databaseName}`], { shell: false, stdio: "ignore" });
}

let failure;
try {
  await run(psqlCommand, [adminDatabaseUrl, "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS ${databaseName}`], { shell: false, stdio: "ignore" });
  await run(psqlCommand, [adminDatabaseUrl, "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE ${databaseName}`], { shell: false, stdio: "ignore" });
  await run("pnpm", ["db:migrate"]);
  await run("pnpm", ["db:seed"]);
  await run("pnpm", ["db:seed"]);
  await run("pnpm", ["build"]);
  start("pnpm", ["--filter", "@sme-invoicing/api", "start"], "api");
  start("pnpm", ["--filter", "@sme-invoicing/web", "exec", "next", "start", "--port", "3100"], "web");
  start("pnpm", ["--filter", "@sme-invoicing/marketing", "exec", "next", "start", "--port", "3102"], "marketing");
  await waitFor("http://localhost:4100/health");
  await waitFor("http://localhost:3100/");
  await waitFor("http://localhost:3102/");
  await run("pnpm", ["exec", "playwright", "test", "-c", "e2e/playwright.config.ts"]);
} catch (error) {
  failure = error;
} finally {
  try {
    await teardown();
  } catch (error) {
    if (!failure) failure = error;
    else console.error(`E2E teardown failed: ${error.message}`);
  }
}

if (failure) {
  console.error(`E2E logs are available in ${logDir}`);
  throw failure;
}
