export type ConfidenceLevel = 'suppressed' | 'early' | 'directional' | 'reliable';

export function getConfidenceLevel(n: number): ConfidenceLevel {
  if (n < 5) return 'suppressed';
  if (n < 25) return 'early';
  if (n < 100) return 'directional';
  return 'reliable';
}

export const CONFIDENCE_CONFIG: Record<ConfidenceLevel, { label: string; description: string }> = {
  suppressed: {
    label: 'Not enough reports yet',
    description: 'We need at least 5 reviews before showing scores.',
  },
  early: {
    label: 'Early / Small Sample',
    description: 'Based on a small number of reviews. Interpret with care.',
  },
  directional: {
    label: 'Directional',
    description: 'A meaningful signal backed by a growing number of reviews.',
  },
  reliable: {
    label: 'Reliable',
    description: 'Based on 100+ reviews. This is a strong signal.',
  },
};

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
