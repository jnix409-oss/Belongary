-- Belongary: initial schema for anonymous workplace-belonging reviews.
-- Approved by founder; awaiting privacy-counsel sign-off before deploy.
--
-- Key design decisions:
--   • No user accounts, auth, or user_id anywhere.
--   • Removal tokens are SHA-256 hashed; plaintext shown once on submit.
--   • Contact email stored in submission_tokens, never on the review row.
--   • No IP address or submission metadata stored.
--   • RLS: anon can INSERT pending reviews, SELECT approved reviews.

-- ============================================================
-- 1. Companies
-- ============================================================
CREATE TABLE companies (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  industry        text,
  hq_metro        text,
  parent_company_id uuid REFERENCES companies(id),
  created_at      timestamptz DEFAULT now()
);

-- ============================================================
-- 2. Reviews
-- ============================================================
CREATE TABLE reviews (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id),
  headline            text NOT NULL CHECK (headline IN ('yes','no','depends')),
  story               text NOT NULL,

  -- Eight dimensions of belonging (1-5, nullable = skipped)
  dim_belonging       smallint CHECK (dim_belonging       BETWEEN 1 AND 5),
  dim_heard           smallint CHECK (dim_heard           BETWEEN 1 AND 5),
  dim_manager         smallint CHECK (dim_manager         BETWEEN 1 AND 5),
  dim_sponsorship     smallint CHECK (dim_sponsorship     BETWEEN 1 AND 5),
  dim_promotion       smallint CHECK (dim_promotion       BETWEEN 1 AND 5),
  dim_growth          smallint CHECK (dim_growth          BETWEEN 1 AND 5),
  dim_representation  smallint CHECK (dim_representation  BETWEEN 1 AND 5),
  dim_flexibility     smallint CHECK (dim_flexibility     BETWEEN 1 AND 5),

  -- Identity lens (single value, nullable)
  lens                text,

  -- Moderation workflow
  moderation_status   text NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending','approved','rejected')),

  created_at          timestamptz DEFAULT now()
);

-- ============================================================
-- 3. Submission tokens (removal)
-- ============================================================
-- token_hash = SHA-256 of the plaintext token.
-- email is NULLABLE — only present if the reviewer chose to provide one.
CREATE TABLE submission_tokens (
  token_hash  text PRIMARY KEY,
  review_id   uuid UNIQUE NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  email       text,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- 4. Row Level Security
-- ============================================================
ALTER TABLE companies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews           ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_tokens ENABLE ROW LEVEL SECURITY;

-- Companies: publicly readable
CREATE POLICY "Companies are publicly readable"
  ON companies FOR SELECT TO anon
  USING (true);

-- Reviews: anon can insert (always pending), anon can read approved only
CREATE POLICY "Anyone can submit a review"
  ON reviews FOR INSERT TO anon
  WITH CHECK (moderation_status = 'pending');

CREATE POLICY "Only approved reviews are publicly readable"
  ON reviews FOR SELECT TO anon
  USING (moderation_status = 'approved');

-- Submission tokens: no public access (service_role only)
-- No policies = no anon access, which is correct.

-- ============================================================
-- 5. Indexes for common queries
-- ============================================================
CREATE INDEX idx_reviews_company    ON reviews(company_id) WHERE moderation_status = 'approved';
CREATE INDEX idx_reviews_moderation ON reviews(moderation_status) WHERE moderation_status = 'pending';
CREATE INDEX idx_companies_slug     ON companies(slug);
