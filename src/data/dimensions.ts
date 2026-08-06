export const DIMENSIONS = [
  { id: 'belonging', label: 'Belonging & Inclusion', icon: '/brand/icons/belonging.svg' },
  { id: 'heard', label: 'Feeling Heard / Seen', icon: '/brand/icons/feedback.svg' },
  { id: 'manager', label: 'Manager Support', icon: '/brand/icons/manager-support.svg' },
  { id: 'sponsorship', label: 'Sponsorship & Access', icon: '/brand/icons/safe-to-speak.svg' },
  { id: 'promotion', label: 'Promotion Fairness', icon: '/brand/icons/fairness.svg' },
  { id: 'growth', label: 'Growth & Mobility', icon: '/brand/icons/career-growth.svg' },
  { id: 'representation', label: 'Representation & Role Models', icon: '/brand/icons/learning.svg' },
  { id: 'flexibility', label: 'Flexibility & Autonomy', icon: '/brand/icons/flexibility.svg' },
] as const;

export type DimensionId = typeof DIMENSIONS[number]['id'];
