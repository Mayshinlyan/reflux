/** Medication types. Keys are stored; never rename. */
export const MEDICATION_TYPES = [
  { key: 'ppi', label: 'PPI' },
  { key: 'h2_blocker', label: 'H2 blocker' },
  { key: 'antacid', label: 'Antacid' },
  { key: 'alginate', label: 'Alginate' },
  { key: 'other', label: 'Other' },
] as const;

export type MedicationType = (typeof MEDICATION_TYPES)[number]['key'];
export const MEDICATION_TYPE_KEYS = MEDICATION_TYPES.map((type) => type.key) as [
  MedicationType,
  ...MedicationType[],
];
