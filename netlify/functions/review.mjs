/**
 * Netlify Function: POST /api/review
 *
 * Accepts a review submission, generates a one-time removal token,
 * stores the SHA-256 hash in Supabase, and returns the plaintext
 * token to the reviewer exactly once.
 *
 * Architecture rationale:
 *   • All Supabase access goes through this proxy — the service_role
 *     key never reaches the client and Supabase never sees the
 *     reviewer's IP address.
 *   • The plaintext token is returned in the response and displayed
 *     on the success page. It is never persisted server-side.
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/** Valid identity-lens IDs (must match src/data/lenses.ts). */
const VALID_LENSES = new Set([
  'poc', '40plus', 'caregiver', 'veteran', 'exgov', 'exfounder', 'firstgen',
]);

const VALID_HEADLINES = new Set(['yes', 'no', 'depends']);

/**
 * Generate a cryptographically random removal token and its SHA-256 hash.
 *
 * Format: BELONGARY-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
 *   • 25 random bytes (200 bits) encoded in a 32-char no-confusables alphabet
 *     (A-Z minus I,O plus 2-9) → 40 characters → 10 groups of 4.
 *   • Grouped and prefixed for human readability; same entropy as before.
 *   • The full formatted string (prefix + dashes + groups) is hashed with
 *     SHA-256 and the hash is stored. The plaintext is returned once.
 */
async function generateToken() {
  const { randomBytes, createHash } = await import('node:crypto');
  const raw = randomBytes(25); // 200 bits of entropy

  // Encode as base32 with a no-confusables alphabet (32 chars).
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let encoded = '';
  let bits = 0;
  let value = 0;
  for (const byte of raw) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      encoded += ALPHABET[(value >> bits) & 0x1F];
    }
  }
  if (bits > 0) {
    encoded += ALPHABET[(value << (5 - bits)) & 0x1F];
  }

  // Group into 4-char segments with prefix.
  const groups = encoded.match(/.{1,4}/g).join('-');
  const plaintext = `BELONGARY-${groups}`;

  const hash = createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, hash };
}

/**
 * Parse a dimension value from form data.
 * Returns null (skipped) or a number 1-5.
 */
function parseDimension(formData, key) {
  const raw = formData.get(key);
  if (raw === null || raw === '' || raw === undefined) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

/**
 * Look up or create a company by name.
 * Creates a slug from the company name for URL routing.
 */
async function resolveCompany(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Try to find existing company first
  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) return existing.id;

  // Create new company
  const { data: created, error } = await supabase
    .from('companies')
    .insert({ slug, name })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create company: ${error.message}`);
  return created.id;
}

export default async function handler(req) {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await req.formData();

    // --- Honeypot check ---
    if (formData.get('bot-field')) {
      // Silently accept (don't reveal the honeypot)
      return new Response(JSON.stringify({ success: true, token: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- Validate required fields ---
    const companyName = formData.get('company')?.trim();
    const story = formData.get('story')?.trim() || null;
    const headline = formData.get('headline')?.trim()?.toLowerCase();

    if (!companyName) {
      return new Response(JSON.stringify({ error: 'Company is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (!headline || !VALID_HEADLINES.has(headline)) {
      return new Response(JSON.stringify({ error: 'Please answer the headline question.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const has_story = story !== null;

    // --- Parse optional fields ---
    const dimensions = {
      dim_belonging:      parseDimension(formData, 'dim_belonging'),
      dim_heard:          parseDimension(formData, 'dim_heard'),
      dim_manager:        parseDimension(formData, 'dim_manager'),
      dim_sponsorship:    parseDimension(formData, 'dim_sponsorship'),
      dim_promotion:      parseDimension(formData, 'dim_promotion'),
      dim_growth:         parseDimension(formData, 'dim_growth'),
      dim_representation: parseDimension(formData, 'dim_representation'),
      dim_flexibility:    parseDimension(formData, 'dim_flexibility'),
    };

    // Lens: take first valid checked value (form sends multiple if multi-checked,
    // but schema stores one — take the first valid one)
    const lensValues = formData.getAll('lens');
    const lens = lensValues.find(v => VALID_LENSES.has(v)) ?? null;

    const email = formData.get('email')?.trim() || null;

    // --- Resolve company ---
    const companyId = await resolveCompany(companyName);

    // --- Insert review ---
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .insert({
        company_id: companyId,
        headline,
        story,
        has_story,
        lens,
        ...dimensions,
        moderation_status: 'pending',
      })
      .select('id')
      .single();

    if (reviewError) {
      console.error('Review insert error:', reviewError);
      return new Response(JSON.stringify({ error: 'Failed to save review. Please try again.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- Generate removal token ---
    const { plaintext, hash } = await generateToken();

    const { error: tokenError } = await supabase
      .from('submission_tokens')
      .insert({
        token_hash: hash,
        review_id: review.id,
        email,
      });

    if (tokenError) {
      console.error('Token insert error:', tokenError);
      // Review is saved but token failed — still return success
      // but warn the reviewer
      return new Response(JSON.stringify({
        success: true,
        token: null,
        warning: 'Your review was saved, but we could not generate a removal token. Contact support@belongary.com for help.',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- Success: return plaintext token (shown once, never stored) ---
    return new Response(JSON.stringify({
      success: true,
      token: plaintext,
      company: companyName,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Unhandled error in review function:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const config = {
  path: '/api/review',
  method: 'POST',
};
