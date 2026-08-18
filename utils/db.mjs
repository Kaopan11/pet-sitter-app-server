import "dotenv/config";
import * as pg from "pg";

const { Pool } = pg.default;

const connectionString =
  process.env.DATABASE_URL || process.env.CONNECTION_STRING;

const isSupabase = /supabase\.(co|com)/i.test(connectionString ?? "");

const connectionPool = new Pool({
  connectionString,
  ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
});

export default connectionPool;
