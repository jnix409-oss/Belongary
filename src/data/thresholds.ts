import { MIN_REVIEWS_DISPLAY, MIN_REVIEWS_SENSITIVE_LENS } from '../config';

/**
 * Returns true when `count` meets or exceeds the display threshold.
 * Sensitive lenses (identity-based) require a higher bar to protect anonymity.
 */
export function hasThreshold(count: number, isSensitiveLens = false): boolean {
  const min = isSensitiveLens ? MIN_REVIEWS_SENSITIVE_LENS : MIN_REVIEWS_DISPLAY;
  return count >= min;
}

/**
 * Returns the threshold number that applies, for display in progress UI.
 */
export function getThreshold(isSensitiveLens = false): number {
  return isSensitiveLens ? MIN_REVIEWS_SENSITIVE_LENS : MIN_REVIEWS_DISPLAY;
}

// --- Score display helpers (only used when hasThreshold() is true) ---

export function getScoreColor(score: number): string {
  if (score >= 3.5) return '#3E8E7E';
  if (score >= 2.5) return '#EBA048';
  return '#D9645A';
}

export function getScoreLabel(score: number): string {
  if (score >= 4.0) return 'Strong';
  if (score >= 3.5) return 'Good';
  if (score >= 2.5) return 'Mixed';
  return 'Low';
}

export function getHeadlineBadge(pct: number): { label: string; color: string } {
  if (pct >= 70) return { label: 'Good', color: '#3E8E7E' };
  if (pct >= 40) return { label: 'Mixed', color: '#EBA048' };
  return { label: 'Low', color: '#D9645A' };
}
