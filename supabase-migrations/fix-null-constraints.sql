-- Run this to fix the NOT NULL constraints on existing tables
-- This allows department, role, name, and roles to be NULL

ALTER TABLE public.role_permissions ALTER COLUMN department DROP NOT NULL;
ALTER TABLE public.role_permissions ALTER COLUMN role DROP NOT NULL;

ALTER TABLE public.department_configs ALTER COLUMN name DROP NOT NULL;
ALTER TABLE public.department_configs ALTER COLUMN roles DROP NOT NULL;

-- Drop the unique constraint on name if it exists
ALTER TABLE public.department_configs DROP CONSTRAINT IF EXISTS department_configs_name_key;
