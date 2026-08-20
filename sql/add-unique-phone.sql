-- กันเบอร์ซ้ำในระบบ (รันใน Supabase SQL Editor)
-- ถ้ามีเบอร์ซ้ำในข้อมูลเก่า ต้อง clean ก่อนรัน migration นี้

ALTER TABLE public.users
ADD CONSTRAINT users_phone_unique UNIQUE (phone);
