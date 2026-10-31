-- Add district (Khu vực / Quận/Huyện) to hr_profiles table
ALTER TABLE hr_profiles ADD COLUMN IF NOT EXISTS district character varying DEFAULT '';
