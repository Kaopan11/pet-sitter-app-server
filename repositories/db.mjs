import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

// เชื่อม PostgreSQL โดยตรง (Direct connection จาก Supabase)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
