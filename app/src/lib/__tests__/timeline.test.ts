import type { StoredFoodLog } from '@/db/repositories/food';
import type { SymptomLogWithDetails } from '@/db/repositories/symptoms';
import type { MedicationLog } from '@/db/schema';

import { buildTimeline, groupSymptoms, symptomLabel, tagLabel } from '../timeline';

const base = { createdAt: '', updatedAt: '', notes: null, foodLogId: null };

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

  it('groups by local day, newest first, summarising a symptom entry by body area', () => {
    const sections = buildTimeline(data, 'all', now, 'Europe/London');

    expect(sections.map((s) => s.label)).toEqual(['Today', 'Yesterday']);
    expect(sections[0]?.entries.map((e) => [e.kind, e.title])).toEqual([
      ['symptom', 'Throat & voice · Chest'],
      ['food', 'Oatmeal with banana'],
      ['medication', 'Omeprazole 20mg'],
    ]);
  });

  it('puts a count and the time under the title of a symptom entry', () => {
    const [entry] = buildTimeline(data, 'symptom', now, 'Europe/London')[0]?.entries ?? [];

    expect(entry?.meta).toMatch(/^2 symptoms · .*8:20/);
    expect(entry?.time).toMatch(/8:20/);
  });

  it('says "1 symptom" in the singular and keeps the time-only line for meals and medications', () => {
    const one: SymptomLogWithDetails = {
      ...symptom(4, '2026-09-28T19:00:00.000Z'),
      items: [{ key: 'cough', score: 1 }],
    };
    const sections = buildTimeline(
      { symptoms: [one], food: data.food, medications: data.medications },
      'all',
      now,
      'Europe/London',
    );
    const byKind = Object.fromEntries((sections[0]?.entries ?? []).map((e) => [e.kind, e]));

    expect(byKind.symptom?.title).toBe('Chest');
    expect(byKind.symptom?.meta).toMatch(/^1 symptom · /);
    expect(byKind.food?.meta).toBe(byKind.food?.time);
    expect(byKind.medication?.meta).toBe(byKind.medication?.time);
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

describe('groupSymptoms', () => {
  it('groups symptoms under their body area, in map order', () => {
    const groups = groupSymptoms([
      { key: 'feeling_full' },
      { key: 'heartburn' },
      { key: 'hoarseness' },
      { key: 'lump' },
      { key: 'stomach_pain' },
    ]);

    expect(groups).toEqual([
      { zone: 'throat', label: 'Throat & voice', keys: ['hoarseness', 'lump'] },
      { zone: 'chest', label: 'Chest', keys: ['heartburn'] },
      { zone: 'tummy', label: 'Tummy', keys: ['stomach_pain', 'feeling_full'] },
    ]);
  });

  it('leaves out areas with nothing chosen', () => {
    expect(groupSymptoms([{ key: 'constipation' }]).map((group) => group.label)).toEqual(['Tummy']);
    expect(groupSymptoms([])).toEqual([]);
  });

  it('shows a retired symptom (Trouble sleeping on older entries) under "Other", after the areas', () => {
    const groups = groupSymptoms([{ key: 'sleep' }, { key: 'cough' }]);

    expect(groups.map((group) => group.label)).toEqual(['Chest', 'Other']);
    expect(groups[1]?.keys).toEqual(['sleep']);
  });

  it('puts a symptom the user typed under "Other" and labels it with their own text', () => {
    const groups = groupSymptoms([{ key: 'custom:Hiccups' }, { key: 'cough' }]);

    expect(groups.map((group) => group.label)).toEqual(['Chest', 'Other']);
    expect(groups[1]?.keys).toEqual(['custom:Hiccups']);
    expect(symptomLabel('custom:Hiccups')).toBe('Hiccups');
    expect(symptomLabel('cough')).toBe('Nagging cough');
    expect(tagLabel('custom:Skipped breakfast')).toBe('Skipped breakfast');
    expect(tagLabel('large_meal')).toBe('Large meal');
  });
});
