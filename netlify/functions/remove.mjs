/**
 * Netlify Function: POST /api/remove
 *
 * Accepts a removal token, verifies it against the hashed tokens
 * in Supabase, and hard-deletes the associated review.
 *
 * Design:
 *   • Token is the only input — no email, no login, no review ID.
 *   • Token is SHA-256 hashed and matched against submission_tokens.token_hash.
 *   • On match: log the removal date (anonymous), then hard-delete the review.
 *     ON DELETE CASCADE on submission_tokens.review_id handles the token row.
 *   • On no match: return a generic message. Never reveal whether a token existed.
 *   • In-memory rate limiting per IP (10 attempts per 15 minutes).
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ---------- Rate limiting (in-memory, per function instance) ----------

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 10;

/** @type {Map<string, { count: number, resetAt: number }>} */
const rateLimitMap = new Map();

/**
 * Check and increment the rate limit for a given key.
 * Returns true if the request is allowed, false if rate-limited.
 */
function checkRateLimit(key) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count += 1;
  return true;
}

// Periodically prune expired entries to prevent unbounded growth.
// Runs at most once per window period.
let lastPrune = 0;
function pruneIfNeeded() {
  const now = Date.now();
  if (now - lastPrune < RATE_LIMIT_WINDOW_MS) return;
  lastPrune = now;
  for (const [key, entry] of rateLimitMap) {
    if (now >= entry.resetAt) rateLimitMap.delete(key);
  }
}

// ---------- Handler ----------

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate limit by IP (Netlify provides this header).
  const ip = req.headers.get('x-nf-client-connection-ip') || 'unknown';
  pruneIfNeeded();

  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: 'Too many requests. Please try again later.' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '900',
      },
    });
  }

  try {
    // Accept both JSON and form-encoded bodies.
    let token;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      token = typeof body.token === 'string' ? body.token.trim() : '';
    } else {
      const formData = await req.formData();
      token = formData.get('token')?.trim() || '';
    }

    if (!token) {
      return new Response(JSON.stringify({ error: 'A removal token is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Normalize: uppercase, collapse whitespace, trim.
    // Users may paste with different casing or accidental spaces.
    token = token.toUpperCase().replace(/\s+/g, '').trim();

    // Hash the submitted token.
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256').update(token).digest('hex');

    // Look up the token.
    const { data: match, error: lookupError } = await supabase
      .from('submission_tokens')
      .select('review_id')
      .eq('token_hash', hash)
      .maybeSingle();

    if (lookupError) {
      console.error('Token lookup error:', lookupError);
      return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generic response for no match — do not reveal whether the token ever existed.
    if (!match) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No review was found for that token. The token may be incorrect, or the review may have already been removed.',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Log the removal (anonymous — just a date, no content or identifiers).
    const { error: logError } = await supabase
      .from('removal_log')
      .insert({ removed_date: new Date().toISOString().slice(0, 10) });

    if (logError) {
      // Non-fatal: log it but proceed with the deletion.
      console.error('Removal log insert error:', logError);
    }

    // Hard-delete the review. ON DELETE CASCADE on submission_tokens.review_id
    // will also remove the token row.
    const { error: deleteError } = await supabase
      .from('reviews')
      .delete()
      .eq('id', match.review_id);

    if (deleteError) {
      console.error('Review delete error:', deleteError);
      return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Your review has been permanently removed.',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Unhandled error in remove function:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const config = {
  path: '/api/remove',
  method: 'POST',
};
