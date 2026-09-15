-- ============================================================
-- Belongary — Level 2 "unlinkable storage" migration
-- Write it here, run it in Supabase SQL editor after review.
-- Assumes migrations 001, 002, 003 have already been applied.
-- ============================================================

-- ============================================================
-- §0 Safety check: reviews must carry NO identity columns.
--    If any of these exist, drop them.
-- ============================================================
ALTER TABLE public.reviews DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.reviews DROP COLUMN IF EXISTS email;
ALTER TABLE public.reviews DROP COLUMN IF EXISTS reviewer_name;
ALTER TABLE public.reviews DROP COLUMN IF EXISTS ip_address;

-- ============================================================
-- §1 Convert created_at (timestamptz) → created_on (date)
--    Timing correlation is a de-anonymization vector.
--    Reviews and removal_log get date-only columns.
-- ============================================================

-- Reviews: add date-only column, backfill, drop old timestamp
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS created_on date;
UPDATE public.reviews SET created_on = created_at::date WHERE created_on IS NULL;
ALTER TABLE public.reviews ALTER COLUMN created_on SET NOT NULL;
ALTER TABLE public.reviews ALTER COLUMN created_on SET DEFAULT current_date;
ALTER TABLE public.reviews DROP COLUMN IF EXISTS created_at;

-- submission_tokens: drop timestamp (only needed token_hash + review_id + email)
ALTER TABLE public.submission_tokens DROP COLUMN IF EXISTS created_at;

-- ============================================================
-- §2 Submission guard — one review per person per company,
--    stored as a one-way hash. No FK to auth.users on purpose.
--    guard_hash = sha256(auth_sub || ':' || company_id || ':' || GUARD_SECRET)
--    computed in the Netlify Function; GUARD_SECRET never enters Supabase.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.submission_guard (
  guard_hash  text PRIMARY KEY,
  created_on  date NOT NULL DEFAULT current_date   -- date only, no timestamp
);

COMMENT ON TABLE public.submission_guard IS
  'One-way hash of (account sub + company + server secret). Enforces one review per person per company. Cannot be reversed to an account or a review.';

-- ============================================================
-- §3 Move token_hash from submission_tokens onto the reviews table.
--    Level 2 stores token_hash directly on the review row so the
--    delete_review_by_token function can find the review without
--    joining through a table that also stores email.
--    The email column on submission_tokens is dropped entirely
--    (Level 2 does not accept contact email — the token is the
--    only deletion credential).
-- ============================================================

-- Add token_hash column to reviews
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS token_hash text UNIQUE;

-- Migrate existing token_hashes from submission_tokens to reviews
UPDATE public.reviews r
   SET token_hash = st.token_hash
  FROM public.submission_tokens st
 WHERE st.review_id = r.id
   AND r.token_hash IS NULL;

-- Drop submission_tokens table — no longer needed at Level 2
-- (email storage removed; token_hash now lives on reviews)
DROP TABLE IF EXISTS public.submission_tokens;

-- ============================================================
-- §4 Row Level Security — deny by default everywhere.
--    No policies for anon or authenticated on write tables.
--    The Netlify Function uses the service-role key, which bypasses RLS.
-- ============================================================
ALTER TABLE public.reviews          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_guard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.removal_log      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies        ENABLE ROW LEVEL SECURITY;

-- Force RLS even for the table owner (belt and braces)
ALTER TABLE public.reviews          FORCE ROW LEVEL SECURITY;
ALTER TABLE public.submission_guard FORCE ROW LEVEL SECURITY;
ALTER TABLE public.removal_log      FORCE ROW LEVEL SECURITY;

-- Drop all existing permissive policies on sensitive tables
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('reviews','submission_guard','removal_log','submission_tokens')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- Companies directory is public-read only
DROP POLICY IF EXISTS "Companies are publicly readable" ON public.companies;
DROP POLICY IF EXISTS companies_public_read ON public.companies;
CREATE POLICY companies_public_read
  ON public.companies FOR SELECT
  TO anon, authenticated
  USING (true);

-- ============================================================
-- §5 Public read surface — company aggregates only.
--    Never expose individual rows, stories, lenses, review IDs, or dates.
--    The database enforces the same five-review threshold as src/config.ts
--    so a future client cannot accidentally bypass it.
-- ============================================================
REVOKE ALL ON public.reviews          FROM anon, authenticated;
REVOKE ALL ON public.submission_guard FROM anon, authenticated;
REVOKE ALL ON public.removal_log      FROM anon, authenticated;

DROP VIEW IF EXISTS public.reviews_public;
CREATE VIEW public.reviews_public
WITH (security_invoker = false) AS
SELECT
  r.company_id,
  count(*)::integer AS review_count,
  count(*) FILTER (WHERE r.headline = 'yes')::integer AS headline_yes,
  count(*) FILTER (WHERE r.headline = 'no')::integer AS headline_no,
  count(*) FILTER (WHERE r.headline = 'depends')::integer AS headline_depends,
  avg(r.dim_belonging)::numeric(3,2) AS dim_belonging,
  avg(r.dim_heard)::numeric(3,2) AS dim_heard,
  avg(r.dim_manager)::numeric(3,2) AS dim_manager,
  avg(r.dim_sponsorship)::numeric(3,2) AS dim_sponsorship,
  avg(r.dim_promotion)::numeric(3,2) AS dim_promotion,
  avg(r.dim_growth)::numeric(3,2) AS dim_growth,
  avg(r.dim_representation)::numeric(3,2) AS dim_representation,
  avg(r.dim_flexibility)::numeric(3,2) AS dim_flexibility
FROM public.reviews r
WHERE r.moderation_status = 'approved'
GROUP BY r.company_id
HAVING count(*) >= 5;

GRANT SELECT ON public.reviews_public TO anon, authenticated;

-- ============================================================
-- §6 Hard-delete by token (called from the Netlify Function
--    with service role). Logs date only.
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_review_by_token(p_token_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count int;
BEGIN
  DELETE FROM public.reviews WHERE token_hash = p_token_hash;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  IF deleted_count > 0 THEN
    INSERT INTO public.removal_log (removed_date) VALUES (current_date);
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_review_by_token(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_review_by_token(text) TO service_role;

-- ============================================================
-- §7 Lock down auth.users exposure.
--    Supabase Auth will store email + name from Google/LinkedIn.
--    Do NOT create a public.profiles table that mirrors it.
-- ============================================================
DROP TABLE IF EXISTS public.profiles CASCADE;

-- ============================================================
-- §8 Verification queries — run after applying.
--    Each is commented; uncomment and run to confirm.
-- ============================================================

-- No FKs from reviews / submission_guard to auth.users:
-- SELECT conname, conrelid::regclass, confrelid::regclass
-- FROM pg_constraint WHERE contype='f' AND confrelid = 'auth.users'::regclass;

-- RLS status:
-- SELECT relname, relrowsecurity, relforcerowsecurity
-- FROM pg_class WHERE relname IN ('reviews','submission_guard','removal_log','companies');

-- Policies present (should be only companies_public_read):
-- SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname='public';

-- reviews table has no identity columns:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='reviews'
-- ORDER BY ordinal_position;

-- submission_tokens table should no longer exist:
-- SELECT EXISTS (SELECT 1 FROM information_schema.tables
--   WHERE table_schema='public' AND table_name='submission_tokens');
