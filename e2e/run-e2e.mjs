import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const adminDatabaseUrl = process.env.E2E_ADMIN_DATABASE_URL;
const requestedDatabaseUrl = process.env.E2E_DATABASE_URL;
const psqlCommand = process.env.E2E_PSQL_BIN || (process.platform === "win32"
  ? String.raw`C:\Program Files\PostgreSQL\17\bin\psql.exe`
  : "psql");

if (!adminDatabaseUrl) {
  throw new Error("E2E_ADMIN_DATABASE_URL is required so the runner can drop only its unique database.");
}

let databaseName;
if (requestedDatabaseUrl) {
  databaseName = new URL(requestedDatabaseUrl).pathname.slice(1);
} else {
  databaseName = `sme_invoicing_e2e_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}
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

const paystackStubPort = Number(process.env.E2E_PAYSTACK_STUB_PORT ?? "4599");
const paystackStubUrl = `http://127.0.0.1:${paystackStubPort}`;

const env = {
  ...process.env,
  NODE_ENV: "development",
  DATABASE_URL: databaseUrl,
  TEST_DATABASE_URL: databaseUrl,
  ALLOW_DEMO_SEED: "true",
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY ?? "sk_test_e2e_stub",
  PAYSTACK_BASE_URL: process.env.PAYSTACK_BASE_URL ?? paystackStubUrl,
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
  const closed = new Promise((resolve) => child.once("close", resolve));
  child.stdout?.on("data", (chunk) => log.push(chunk.toString()));
  child.stderr?.on("data", (chunk) => log.push(chunk.toString()));
  children.push({ child, name, log, closed });
}

async function waitFor(url) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Service is not up yet; retry until the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function teardown() {
  await mkdir(logDir, { recursive: true });
  for (const { child, name, log, closed } of children) {
    if (!child.killed && process.platform === "win32") {
      await run("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" }).catch(() => undefined);
    } else if (!child.killed) {
      child.kill("SIGTERM");
    }
    await Promise.race([closed, new Promise((resolve) => setTimeout(resolve, 5_000))]);
    await writeFile(path.join(logDir, `${name}.log`), log.join(""), "utf8");
  }
  await run(psqlCommand, [adminDatabaseUrl, "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS ${databaseName}`], { shell: false, stdio: "ignore" });
}

async function snapshotSeedState() {
  const query = `
    SELECT json_build_object(
      'receipts', COALESCE(json_agg(json_build_object(
        'id', r.id,
        'paymentId', r.payment_id,
        'receiptNumber', r.receipt_number,
        'publicToken', r.public_token
      ) ORDER BY r.id) FILTER (WHERE r.id IS NOT NULL), '[]'::json),
      'receiptSequence', (SELECT next_number FROM receipt_number_sequences WHERE organisation_id = o.id),
      'auditCount', (SELECT count(*) FROM audit_logs WHERE organisation_id = o.id AND action = 'receipt_generated'),
      'catalogue', COALESCE((SELECT json_agg(json_build_object(
        'name', c.name,
        'defaultUnitPriceKobo', c.default_unit_price_kobo,
        'archived', (c.archived_at IS NOT NULL)
      ) ORDER BY c.name) FROM catalogue_items c WHERE c.organisation_id = o.id), '[]'::json),
      'showcaseInvoice', (SELECT json_build_object(
        'invoiceNumber', i.invoice_number,
        'status', i.status,
        'customerReference', i.customer_reference,
        'totalKobo', i.total_kobo
      ) FROM invoices i WHERE i.organisation_id = o.id AND i.invoice_number = 'INV-000025'),
      'sentinel', (SELECT json_build_object('name', s.name, 'slug', s.slug) FROM organisations s WHERE s.slug = 'e2e-sentinel')
    )
    FROM organisations o
    LEFT JOIN receipts r ON r.organisation_id = o.id
    WHERE o.slug = 'akin-co-demo'
    GROUP BY o.id;
  `;
  return (await run(psqlCommand, [databaseUrl, "-At", "-c", query], { shell: false, stdio: ["ignore", "pipe", "pipe"] })).trim();
}

const paystackStubAmounts = new Map();

function readStubBody(request) {
  return new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendStubJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(body);
}

async function startPaystackStub() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", paystackStubUrl);

    if (request.method === "GET" && url.pathname === "/bank") {
      sendStubJson(response, 200, {
        status: true,
        message: "Banks retrieved",
        data: [
          {
            active: true,
            code: "033",
            country: "Nigeria",
            currency: "NGN",
            name: "United Bank for Africa"
          }
        ]
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/bank/resolve") {
      const accountNumber = url.searchParams.get("account_number") ?? "0123456789";
      const bankCode = url.searchParams.get("bank_code") ?? "033";
      sendStubJson(response, 200, {
        status: true,
        message: "Account resolved",
        data: {
          account_name: "Akin & Co Creative Services",
          account_number: accountNumber,
          bank_code: bankCode
        }
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/subaccount") {
      await readStubBody(request);
      sendStubJson(response, 200, {
        status: true,
        message: "Subaccount created",
        data: {
          active: true,
          currency: "NGN",
          id: 999001,
          is_verified: true,
          settlement_schedule: "weekly",
          subaccount_code: "ACCT_e2e_stub_active"
        }
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/transaction/initialize") {
      const body = await readStubBody(request);
      const reference = String(body.reference ?? `E2E-STUB-${Date.now()}`);
      const amount = Number(body.amount ?? 0);
      paystackStubAmounts.set(reference, Number.isFinite(amount) ? amount : 0);
      sendStubJson(response, 200, {
        status: true,
        message: "Authorization URL created",
        data: {
          authorization_url: `${paystackStubUrl}/paystack/checkout/${encodeURIComponent(reference)}`,
          access_code: `stub_${reference}`,
          reference
        }
      });
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/transaction/verify/")) {
      const reference = decodeURIComponent(url.pathname.replace("/transaction/verify/", ""));
      sendStubJson(response, 200, {
        status: true,
        message: "Verification successful",
        data: {
          reference,
          status: "success",
          amount: paystackStubAmounts.get(reference) ?? 0,
          currency: "NGN",
          paid_at: new Date().toISOString(),
          channel: "card",
          gateway_response: "Successful"
        }
      });
      return;
    }

    sendStubJson(response, 404, { status: false, message: "Test Paystack stub has no such route." });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(paystackStubPort, "127.0.0.1", () => resolve());
  });

  return server;
}

let failure;
let paystackStub;
try {
  paystackStub = await startPaystackStub();
  await run(psqlCommand, [adminDatabaseUrl, "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS ${databaseName}`], { shell: false, stdio: "ignore" });
  await run(psqlCommand, [adminDatabaseUrl, "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE ${databaseName}`], { shell: false, stdio: "ignore" });
  await run("pnpm", ["db:migrate"]);
  await run(psqlCommand, [databaseUrl, "-v", "ON_ERROR_STOP=1", "-c", "INSERT INTO organisations (name, slug) VALUES ('E2E Sentinel', 'e2e-sentinel') ON CONFLICT (slug) DO NOTHING"], { shell: false, stdio: "ignore" });
  await run("pnpm", ["db:seed"]);
  const firstSeedSnapshot = await snapshotSeedState();
  await run("pnpm", ["db:seed"]);
  const secondSeedSnapshot = await snapshotSeedState();
  if (firstSeedSnapshot !== secondSeedSnapshot) {
    throw new Error("Demo seed is not repeat-stable; receipt or sentinel state changed between runs.");
  }
  await run("pnpm", ["build"]);
  start("pnpm", ["--filter", "@sme-invoicing/api", "start"], "api");
  start("pnpm", ["--filter", "@sme-invoicing/web", "exec", "next", "start", "--port", "3100"], "web");
  start("pnpm", ["--filter", "@sme-invoicing/marketing", "exec", "next", "start", "--port", "3102"], "marketing");
  await waitFor("http://localhost:4100/health");
  await waitFor("http://localhost:3100/");
  await waitFor("http://localhost:3102/");
  await waitFor(`${paystackStubUrl}/bank?country=nigeria`);
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

  if (paystackStub) {
    await new Promise((resolve) => paystackStub.close(() => resolve()));
  }
}

if (failure) {
  console.error(`E2E logs are available in ${logDir}`);
  throw failure;
}
