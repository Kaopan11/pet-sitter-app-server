-- Ban owner + suspend pet
-- Run once in the Supabase SQL Editor

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

ALTER TABLE public.pets
ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false;
