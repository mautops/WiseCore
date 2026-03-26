/**
 * Connects to the maintenance DB ``postgres`` and creates the database from
 * ``DATABASE_URL`` if missing (e.g. old Docker volume from before POSTGRES_DB).
 *
 * Loads next-console/.env then .env.local (override). If ``DOTENV_CONFIG_PATH``
 * is set, only that file is loaded (for CI).
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

const root = path.join(__dirname, "..");
if (process.env.DOTENV_CONFIG_PATH) {
  require("dotenv").config({ path: process.env.DOTENV_CONFIG_PATH });
} else {
  const envPath = path.join(root, ".env");
  const localPath = path.join(root, ".env.local");
  if (fs.existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
  }
  if (fs.existsSync(localPath)) {
    require("dotenv").config({ path: localPath, override: true });
  }
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("ensure-postgres-database: DATABASE_URL is not set");
  process.exit(1);
}

let adminUrl;
let dbName;
try {
  const u = new URL(databaseUrl);
  const firstSeg = u.pathname.replace(/^\//, "").split("/")[0] ?? "";
  dbName = firstSeg.split("?")[0] ?? "";
  if (!dbName || dbName === "postgres") {
    process.exit(0);
  }
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    console.error(
      "ensure-postgres-database: unsupported database name in DATABASE_URL",
    );
    process.exit(1);
  }
  u.pathname = "/postgres";
  adminUrl = u.toString();
} catch (e) {
  console.error("ensure-postgres-database: invalid DATABASE_URL", e);
  process.exit(1);
}

async function main() {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const { rows } = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName],
    );
    if (rows.length > 0) {
      console.log(`ensure-postgres-database: database "${dbName}" exists`);
      return;
    }
    await admin.query(`CREATE DATABASE "${dbName}"`);
    console.log(`ensure-postgres-database: created database "${dbName}"`);
  } finally {
    await admin.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
