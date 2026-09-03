export const LENSES = [
  { id: 'poc', label: 'Professional of Color' },
  { id: '40plus', label: '40+' },
  { id: 'caregiver', label: 'Caregiver / Parent' },
  { id: 'veteran', label: 'Veteran / Ex-Military' },
  { id: 'exgov', label: 'Ex-Government' },
  { id: 'exfounder', label: 'Ex-Founder' },
  { id: 'firstgen', label: 'First-Gen / Self-Taught' },
] as const;

export type LensId = typeof LENSES[number]['id'];

export function getLensLabel(id: string): string {
  return LENSES.find(l => l.id === id)?.label ?? id;
}
