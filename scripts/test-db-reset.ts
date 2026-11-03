import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

async function resetTestDb() {
  const testDbUrl = process.env.DATABASE_URL_TEST?.trim();
  if (!testDbUrl) {
    console.error("ERROR: DATABASE_URL_TEST is not set in environment or .env file.");
    process.exit(1);
  }

  const sqlFilePath = path.resolve(process.cwd(), "coders_hub_schema.sql");
  if (!fs.existsSync(sqlFilePath)) {
    console.error(`ERROR: Schema file not found at ${sqlFilePath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(sqlFilePath, "utf8");
  console.log(`Connecting to test database: ${testDbUrl.replace(/:[^:@]+@/, ":***@")} ...`);

  const client = new Client({ connectionString: testDbUrl });
  try {
    await client.connect();
    console.log("Connected. Resetting schema 'public'...");

    await client.query("DROP SCHEMA IF EXISTS public CASCADE;");
    await client.query("CREATE SCHEMA public;");
    await client.query("GRANT ALL ON SCHEMA public TO public;");

    console.log("Applying coders_hub_schema.sql...");
    await client.query(sqlContent);

    console.log("Test database reset successfully!");
  } catch (error) {
    console.error("Failed to reset test database:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

resetTestDb();

