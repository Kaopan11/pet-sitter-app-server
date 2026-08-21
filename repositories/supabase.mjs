import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// client กลางของทั้งโปรเจกต์ ใช้ SERVICE_ROLE ฝั่ง server เท่านั้น
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default supabase;
