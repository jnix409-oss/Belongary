export const DIMENSIONS = [
  { id: 'belonging', label: 'Belonging & Inclusion', icon: '🤝' },
  { id: 'heard', label: 'Feeling Heard / Seen', icon: '👁️' },
  { id: 'manager', label: 'Manager Support', icon: '🙌' },
  { id: 'sponsorship', label: 'Sponsorship & Access', icon: '🚪' },
  { id: 'promotion', label: 'Promotion Fairness', icon: '📈' },
  { id: 'growth', label: 'Growth & Mobility', icon: '🌱' },
  { id: 'representation', label: 'Representation & Role Models', icon: '🪞' },
  { id: 'flexibility', label: 'Flexibility & Autonomy', icon: '⚖️' },
] as const;

export type DimensionId = typeof DIMENSIONS[number]['id'];
