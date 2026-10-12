-- Run before deploying the Taskflow and ConX API changes.
-- Keep the existing device association for both apps during migration.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS "TaskflowDeviceId" text,
  ADD COLUMN IF NOT EXISTS "ConxDeviceId" text;

UPDATE public.users
SET
  "TaskflowDeviceId" = COALESCE("TaskflowDeviceId", "DeviceId"::text),
  "ConxDeviceId" = COALESCE("ConxDeviceId", "DeviceId"::text)
WHERE "DeviceId" IS NOT NULL;
