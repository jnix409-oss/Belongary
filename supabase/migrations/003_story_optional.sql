-- Make story optional and add has_story derived boolean.
-- Run this in Supabase SQL Editor before re-enabling submissions.

ALTER TABLE reviews ALTER COLUMN story DROP NOT NULL;

ALTER TABLE reviews ADD COLUMN has_story boolean NOT NULL DEFAULT true;
