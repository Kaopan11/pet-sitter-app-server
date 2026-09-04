-- ============================================================
-- Payout Option v1 — bookings + sitter_profiles
-- รันครั้งเดียวใน Supabase SQL Editor
--
-- สถานะ: รันแล้วบน Supabase (Step 1–4) — 31/08/2026
-- เก็บไฟล์นี้เป็นเอกสาร schema / migration ใน repo
-- ============================================================

BEGIN;

-- ---------- bookings ----------

-- payment_method — เก็บ cash | stripe ตอน create booking
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(10);

ALTER TABLE public.bookings
DROP CONSTRAINT IF EXISTS bookings_payment_method_check;

ALTER TABLE public.bookings
ADD CONSTRAINT bookings_payment_method_check
CHECK (payment_method IS NULL OR payment_method IN ('cash', 'stripe'));

-- transaction_no — generate ตอน create (TX-YYYYMMDD-0001)
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS transaction_no VARCHAR(32);

CREATE UNIQUE INDEX IF NOT EXISTS bookings_transaction_no_unique_idx
ON public.bookings (transaction_no)
WHERE transaction_no IS NOT NULL;

-- sequence สำหรับ running number
CREATE SEQUENCE IF NOT EXISTS public.booking_transaction_no_seq
START WITH 1
INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.next_transaction_no()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  today text := to_char(now() AT TIME ZONE 'Asia/Bangkok', 'YYYYMMDD');
  running int;
BEGIN
  running := nextval('public.booking_transaction_no_seq');
  RETURN format('TX-%s-%s', today, lpad(running::text, 4, '0'));
END;
$$;

-- ---------- sitter_profiles ----------

ALTER TABLE public.sitter_profiles
ADD COLUMN IF NOT EXISTS account_name VARCHAR(100);

ALTER TABLE public.sitter_profiles
ADD COLUMN IF NOT EXISTS book_bank_image_url TEXT;

-- bank_code คู่กับ bank_name เดิม (GET /api/banks)
ALTER TABLE public.sitter_profiles
ADD COLUMN IF NOT EXISTS bank_code VARCHAR(10);

COMMIT;

-- ------------------------------------------------------------
-- Backfill (Q20=C): ไม่ backfill booking เก่า
-- payment_method / transaction_no = NULL → ไม่โผล่ใน payout
-- ------------------------------------------------------------
--
-- Schema หลัง migrate:
--
-- bookings.payment_method   VARCHAR(10)  CHECK (cash|stripe) nullable
-- bookings.transaction_no   VARCHAR(32)  UNIQUE (partial, where not null)
--
-- sitter_profiles.account_name         VARCHAR(100)
-- sitter_profiles.book_bank_image_url  TEXT
-- sitter_profiles.bank_code            VARCHAR(10)
-- (bank_name, account_number มีอยู่แล้ว)
-- ------------------------------------------------------------
