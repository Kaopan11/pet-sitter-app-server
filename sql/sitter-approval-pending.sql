-- รันครั้งเดียวใน Supabase SQL Editor
-- แตะแค่ sitter_profiles: ขยาย status, default Unverified, เพิ่ม is_listed + pending_profile

BEGIN;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'sitter_profiles'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%approval_status%'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.sitter_profiles DROP CONSTRAINT %I',
      constraint_name
    );
  END IF;
END $$;

ALTER TABLE public.sitter_profiles
ADD CONSTRAINT sitter_profiles_approval_status_check
CHECK (approval_status IN (
  'Unverified',
  'Waiting for verify',
  'Verified',
  'Waiting for approve',
  'Approved',
  'Rejected'
));

ALTER TABLE public.sitter_profiles
ALTER COLUMN approval_status SET DEFAULT 'Unverified';

ALTER TABLE public.sitter_profiles
ADD COLUMN IF NOT EXISTS is_listed boolean NOT NULL DEFAULT false;

ALTER TABLE public.sitter_profiles
ADD COLUMN IF NOT EXISTS pending_profile jsonb;

UPDATE public.sitter_profiles
SET is_listed = true
WHERE approval_status = 'Approved';

COMMIT;
