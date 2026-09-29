import type { MedicationType } from './medicationTypes';

export type CommonMedication = {
  /** Saved as the medication's name. */
  name: string;
  /** Picked automatically when this medication is chosen. */
  type: MedicationType;
  /** Typical doses, shown as one-tap choices. */
  doses: readonly string[];
};

/** Reflux medications people commonly take, grouped by type in the picker. Only `name` is stored. */
export const COMMON_MEDICATIONS: readonly CommonMedication[] = [
  { name: 'Omeprazole (Prilosec)', type: 'ppi', doses: ['10mg', '20mg', '40mg'] },
  { name: 'Esomeprazole (Nexium)', type: 'ppi', doses: ['20mg', '40mg'] },
  { name: 'Lansoprazole (Prevacid)', type: 'ppi', doses: ['15mg', '30mg'] },
  { name: 'Pantoprazole (Protonix)', type: 'ppi', doses: ['20mg', '40mg'] },
  { name: 'Rabeprazole (Aciphex)', type: 'ppi', doses: ['10mg', '20mg'] },
  { name: 'Dexlansoprazole (Dexilant)', type: 'ppi', doses: ['30mg', '60mg'] },
  // Technically a potassium-competitive acid blocker, filed under PPI for simplicity.
  { name: 'Vonoprazan (Voquezna)', type: 'ppi', doses: ['10mg', '20mg'] },
  { name: 'Famotidine (Pepcid)', type: 'h2_blocker', doses: ['10mg', '20mg', '40mg'] },
  { name: 'Cimetidine (Tagamet)', type: 'h2_blocker', doses: ['200mg', '400mg'] },
  { name: 'Nizatidine (Axid)', type: 'h2_blocker', doses: ['75mg', '150mg'] },
  { name: 'Tums', type: 'antacid', doses: ['1 tablet', '2 tablets', '3 tablets'] },
  { name: 'Rolaids', type: 'antacid', doses: ['1 tablet', '2 tablets'] },
  { name: 'Mylanta', type: 'antacid', doses: ['1 tablespoon', '2 tablespoons'] },
  { name: 'Maalox', type: 'antacid', doses: ['1 tablespoon', '2 tablespoons'] },
  { name: 'Milk of Magnesia', type: 'antacid', doses: ['1 tablespoon', '2 tablespoons'] },
  { name: 'Gaviscon', type: 'alginate', doses: ['1 tablet', '2 tablets', '10ml', '20ml'] },
  { name: 'Gaviscon Advance', type: 'alginate', doses: ['5ml', '10ml'] },
  { name: 'Gaviscon Double Action', type: 'alginate', doses: ['1 tablet', '2 tablets', '10ml', '20ml'] },
  { name: 'Gaviscon Extra Strength', type: 'alginate', doses: ['2 tablets', '3 tablets', '4 tablets', '2 teaspoons', '4 teaspoons'] },
  { name: 'Peptac', type: 'alginate', doses: ['10ml', '20ml'] },
];

export const findCommonMedication = (name: string): CommonMedication | undefined =>
  COMMON_MEDICATIONS.find((med) => med.name === name);
