-- Optional: กันสร้างห้องซ้ำสำหรับคู่ owner–sitter เดิม
CREATE UNIQUE INDEX IF NOT EXISTS conversations_owner_sitter_unique
  ON public.conversations (owner_id, sitter_id);
