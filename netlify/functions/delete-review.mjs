/**
 * Netlify Function: POST /api/delete-review
 *
 * Level 2 "unlinkable storage" — deletion by token.
 *
 * Accepts a removal token, hashes it, and calls the
 * delete_review_by_token() database function. No auth required —
 * the token IS the credential.
 *
 * Changes from Level 1 (remove.mjs):
 *   • token_hash now lives on the reviews table, not submission_tokens.
 *   • Uses the delete_review_by_token() RPC function instead of
 *     manual lookup + delete.
 *   • Strips identity-leaking headers before any outbound call.
 */

import { createClient } from '@supabase/supabase-js';

// Strip identity-leaking headers from the global fetch.
const _originalFetch = globalThis.fetch;
globalThis.fetch = function patchedFetch(input, init = {}) {
  const headers = new Headers(init.headers);
  headers.delete('x-forwarded-for');
  headers.delete('x-real-ip');
  headers.delete('user-agent');
  headers.delete('referer');
  headers.delete('x-nf-client-connection-ip');
  return _originalFetch(input, { ...init, headers });
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ---------- Rate limiting (in-memory, per function instance) ----------

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 10;

/** @type {Map<string, { count: number, resetAt: number }>} */
const rateLimitMap = new Map();

function checkRateLimit(key) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

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
  // Note: we read the IP for rate-limiting only; it is never written to the DB
  // and the patched fetch above strips it from outbound calls.
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

    // Normalize: uppercase, collapse whitespace.
    token = token.toUpperCase().replace(/\s+/g, '').trim();

    // Hash the submitted token.
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256').update(token).digest('hex');

    // Call the database function (service_role bypasses RLS).
    const { data: deleted, error: rpcError } = await supabase
      .rpc('delete_review_by_token', { p_token_hash: hash });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (deleted) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Your review has been permanently removed.',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generic response — do not reveal whether the token ever existed.
    return new Response(JSON.stringify({
      success: false,
      message: 'No review was found for that token. The token may be incorrect, or the review may have already been removed.',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('Unhandled error in delete-review function:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const config = {
  path: '/api/delete-review',
  method: 'POST',
};
