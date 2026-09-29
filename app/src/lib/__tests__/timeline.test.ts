import type { StoredFoodLog } from '@/db/repositories/food';
import type { SymptomLogWithDetails } from '@/db/repositories/symptoms';
import type { MedicationLog } from '@/db/schema';

import { buildTimeline } from '../timeline';

const base = { createdAt: '', updatedAt: '', notes: null };

const symptom = (id: number, loggedAt: string, tz = 'Europe/London'): SymptomLogWithDetails => ({
  ...base,
  id,
  kind: 'quick',
  loggedAt,
  tz,
  items: [
    { key: 'heartburn', score: 3 },
    { key: 'hoarseness', score: 2 },
  ],
  tags: ['large_meal'],
});

const med = (id: number, takenAt: string): MedicationLog => ({
  ...base,
  id,
  medicationId: 1,
  name: 'Omeprazole',
  type: 'ppi',
  doseText: '20mg',
  takenAt,
  tz: 'Europe/London',
});

const food = (id: number, loggedAt: string) =>
  ({ id, loggedAt, tz: 'Europe/London', mealName: 'Oatmeal with banana' }) as StoredFoodLog;

const now = new Date('2026-09-28T21:00:00.000Z');

describe('buildTimeline', () => {
  const data = {
    symptoms: [symptom(1, '2026-09-28T19:20:00.000Z'), symptom(2, '2026-09-27T20:30:00.000Z')],
    food: [food(1, '2026-09-28T07:12:00.000Z')],
    medications: [med(1, '2026-09-28T07:00:00.000Z')],
  };

  it('groups by local day, newest first, with readable titles', () => {
    const sections = buildTimeline(data, 'all', now, 'Europe/London');

    expect(sections.map((s) => s.label)).toEqual(['Today', 'Yesterday']);
    expect(sections[0]?.entries.map((e) => [e.kind, e.title])).toEqual([
      ['symptom', 'Heartburn, Hoarse voice'],
      ['food', 'Oatmeal with banana'],
      ['medication', 'Omeprazole 20mg'],
    ]);
  });

  it('filters by kind', () => {
    const sections = buildTimeline(data, 'symptom', now, 'Europe/London');
    expect(sections.flatMap((s) => s.entries.map((e) => e.kind))).toEqual(['symptom', 'symptom']);
    expect(buildTimeline(data, 'medication', now, 'Europe/London')).toHaveLength(1);
  });

  it('places a late-night entry on its own local day, not the UTC day', () => {
    // 23:30 UTC on the 27th is 00:30 on the 28th in London (BST).
    const sections = buildTimeline(
      { symptoms: [symptom(3, '2026-09-27T23:30:00.000Z')], food: [], medications: [] },
      'all',
      now,
      'Europe/London',
    );
    expect(sections[0]?.label).toBe('Today');
  });

  it('returns no sections when there is nothing logged', () => {
    expect(buildTimeline({ symptoms: [], food: [], medications: [] }, 'all', now)).toEqual([]);
  });
});
