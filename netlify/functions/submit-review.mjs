/**
 * Netlify Function: POST /api/submit-review
 *
 * Level 2 "unlinkable storage" — the only writer for reviews.
 *
 * Flow:
 *   1. Verify the Supabase JWT from the Authorization header → extract `sub`.
 *   2. Compute guard_hash = sha256(sub + ':' + company_id + ':' + GUARD_SECRET).
 *   3. Insert into submission_guard. On unique-violation → 409 "already reviewed."
 *   4. Generate deletion token BELONGARY-XXXX-…; store sha256(token) as token_hash
 *      on the review row itself.
 *   5. Insert review (content + lens + token_hash + created_on = today).
 *      No `sub`, no email, no IP.
 *   6. Return the plaintext token to the client once. Never log it.
 *
 * Architecture:
 *   • All Supabase writes use the service_role key (never in the client).
 *   • x-forwarded-for, user-agent, and referer are stripped before any
 *     outbound call — the IP address never reaches Supabase.
 *   • The GUARD_SECRET is a 32+ byte random value stored only in Netlify
 *     env vars. It never enters Supabase. Rotating it resets duplicate
 *     prevention (people can re-review). Treat rotation as deliberate.
 */

import { createClient } from '@supabase/supabase-js';

// Strip identity-leaking headers from the global fetch so that no
// downstream call (Supabase SDK included) forwards them.
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

/** Valid identity-lens IDs (must match src/data/lenses.ts). */
const VALID_LENSES = new Set([
  'poc', '40plus', 'caregiver', 'veteran', 'exgov', 'exfounder', 'firstgen',
]);

const VALID_HEADLINES = new Set(['yes', 'no', 'depends']);

// ---------- JWT verification ----------

/**
 * Verify a Supabase JWT and return the decoded payload.
 * Uses HMAC-SHA256 with the SUPABASE_JWT_SECRET.
 */
async function verifyJwt(token) {
  const { createHmac } = await import('node:crypto');

  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed JWT');

  const [headerB64, payloadB64, signatureB64] = parts;

  // Verify signature
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error('SUPABASE_JWT_SECRET not configured');

  const expected = createHmac('sha256', secret)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  // Constant-time comparison
  const { timingSafeEqual } = await import('node:crypto');
  const sigBuf = Buffer.from(signatureB64, 'base64url');
  const expBuf = Buffer.from(expected, 'base64url');
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid JWT signature');
  }

  // Decode payload
  const payload = JSON.parse(
    Buffer.from(payloadB64, 'base64url').toString('utf-8'),
  );

  // Check expiry
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('JWT expired');
  }

  return payload;
}

// ---------- Token generation ----------

/**
 * Generate a cryptographically random removal token and its SHA-256 hash.
 *
 * Format: BELONGARY-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
 *   • 25 random bytes (200 bits) encoded in a 32-char no-confusables alphabet.
 *   • The full formatted string is hashed with SHA-256 and the hash is stored.
 *   • The plaintext is returned once.
 */
async function generateToken() {
  const { randomBytes, createHash } = await import('node:crypto');
  const raw = randomBytes(25); // 200 bits of entropy

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

  const groups = encoded.match(/.{1,4}/g).join('-');
  const plaintext = `BELONGARY-${groups}`;

  const hash = createHash('sha256').update(plaintext).digest('hex');
  return { plaintext, hash };
}

// ---------- Helpers ----------

/**
 * Parse a dimension value from JSON body.
 * Returns null (skipped) or a number 1-5.
 */
function parseDimension(body, key) {
  const raw = body[key];
  if (raw === null || raw === undefined || raw === '') return null;
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

  const { data: existing } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('companies')
    .insert({ slug, name })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create company: ${error.message}`);
  return created.id;
}

// ---------- Handler ----------

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // --- Authenticate: verify Supabase JWT ---
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Sign in required.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let jwtPayload;
    try {
      jwtPayload = await verifyJwt(authHeader.slice(7));
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session. Please sign in again.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const sub = jwtPayload.sub;
    if (!sub) {
      return new Response(JSON.stringify({ error: 'Invalid session.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- Parse JSON body ---
    const body = await req.json();

    // --- Honeypot ---
    if (body['bot-field']) {
      return new Response(JSON.stringify({ success: true, token: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- Validate required fields ---
    const companyName = (body.company || '').trim();
    const headline = (body.headline || '').trim().toLowerCase();
    const story = (body.story || '').trim() || null;

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
      dim_belonging:      parseDimension(body, 'dim_belonging'),
      dim_heard:          parseDimension(body, 'dim_heard'),
      dim_manager:        parseDimension(body, 'dim_manager'),
      dim_sponsorship:    parseDimension(body, 'dim_sponsorship'),
      dim_promotion:      parseDimension(body, 'dim_promotion'),
      dim_growth:         parseDimension(body, 'dim_growth'),
      dim_representation: parseDimension(body, 'dim_representation'),
      dim_flexibility:    parseDimension(body, 'dim_flexibility'),
    };

    // Lens: take first valid value
    const lensValue = Array.isArray(body.lens) ? body.lens[0] : body.lens;
    const lens = (lensValue && VALID_LENSES.has(lensValue)) ? lensValue : null;

    // --- Resolve company ---
    const companyId = await resolveCompany(companyName);

    // --- Duplicate check: submission guard ---
    const { createHash } = await import('node:crypto');
    const guardSecret = process.env.GUARD_SECRET;
    if (!guardSecret) {
      console.error('GUARD_SECRET not configured');
      return new Response(JSON.stringify({ error: 'Server configuration error.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const guardHash = createHash('sha256')
      .update(`${sub}:${companyId}:${guardSecret}`)
      .digest('hex');

    const { error: guardError } = await supabase
      .from('submission_guard')
      .insert({ guard_hash: guardHash });

    if (guardError) {
      // Unique violation = already reviewed this company
      if (guardError.code === '23505') {
        return new Response(JSON.stringify({ error: 'You have already reviewed this company.' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      console.error('Guard insert error:', guardError);
      return new Response(JSON.stringify({ error: 'Failed to save review. Please try again.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // --- Generate removal token ---
    const { plaintext, hash: tokenHash } = await generateToken();

    // --- Insert review (NO sub, NO email, NO IP) ---
    const { error: reviewError } = await supabase
      .from('reviews')
      .insert({
        company_id: companyId,
        headline,
        story,
        has_story,
        lens,
        token_hash: tokenHash,
        ...dimensions,
        moderation_status: 'pending',
        created_on: new Date().toISOString().slice(0, 10),
      });

    if (reviewError) {
      console.error('Review insert error:', reviewError);
      // Clean up the guard entry so they can retry
      await supabase.from('submission_guard').delete().eq('guard_hash', guardHash);
      return new Response(JSON.stringify({ error: 'Failed to save review. Please try again.' }), {
        status: 500,
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
    console.error('Unhandled error in submit-review function:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const config = {
  path: '/api/submit-review',
  method: 'POST',
};
