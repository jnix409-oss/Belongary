-- Removal log: anonymous counter of deleted reviews.
-- Contains no review content, no company reference, no PII.
-- Purpose: track that removals happened and when, nothing more.

CREATE TABLE removal_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  removed_date date DEFAULT current_date
);

-- No RLS policies = no anon access (service_role only), same as submission_tokens.
ALTER TABLE removal_log ENABLE ROW LEVEL SECURITY;
