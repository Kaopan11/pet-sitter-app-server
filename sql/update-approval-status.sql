-- ============================================================
-- อัปเดต approval_status ให้ตรง badge หน้า Admin
-- ค่าใหม่: 'Waiting for approve' | 'Approved' | 'Rejected'
-- (เดิม: 'pending' | 'approved' | 'rejected')
--
-- ถ้ารันไปแล้วบน Supabase ไม่ต้องรันซ้ำ
-- เก็บไฟล์นี้ไว้เป็นเอกสาร schema / migration ใน repo
-- ============================================================

BEGIN;

-- 1) ลบ CHECK เก่า
ALTER TABLE public.sitter_profiles
DROP CONSTRAINT IF EXISTS sitter_profiles_approval_status_check;

-- 2) แปลงข้อมูลเก่า → ใหม่
UPDATE public.sitter_profiles
SET approval_status = 'Waiting for approve'
WHERE approval_status = 'pending';

UPDATE public.sitter_profiles
SET approval_status = 'Approved'
WHERE approval_status = 'approved';

UPDATE public.sitter_profiles
SET approval_status = 'Rejected'
WHERE approval_status = 'rejected';

-- 3) ขยายความยาวคอลัมน์ (ค่าใหม่ยาวกว่า VARCHAR(20))
ALTER TABLE public.sitter_profiles
ALTER COLUMN approval_status TYPE VARCHAR(30);

-- 4) DEFAULT ใหม่
ALTER TABLE public.sitter_profiles
ALTER COLUMN approval_status SET DEFAULT 'Waiting for approve';

-- 5) CHECK ชุดใหม่
ALTER TABLE public.sitter_profiles
ADD CONSTRAINT sitter_profiles_approval_status_check
CHECK (approval_status IN (
  'Waiting for approve',
  'Approved',
  'Rejected'
));

COMMIT;

-- ------------------------------------------------------------
-- Schema ที่ถูกต้องหลัง migrate (แทน CREATE TABLE เก่า):
--
-- approval_status  VARCHAR(30) NOT NULL DEFAULT 'Waiting for approve'
--   CHECK (approval_status IN (
--     'Waiting for approve',
--     'Approved',
--     'Rejected'
--   )),
-- ------------------------------------------------------------
