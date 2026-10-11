import { BODY_ZONES, zoneLabel, zoneSymptoms } from '../bodyZones';
import { RETIRED_SYMPTOM_KEYS, SYMPTOM_ITEMS, SYMPTOM_KEYS } from '../symptomItems';

describe('body zones', () => {
  it('places every symptom still offered in exactly one area', () => {
    const placed = BODY_ZONES.flatMap((zone) => zone.symptoms);
    const offered = SYMPTOM_KEYS.filter((key) => !RETIRED_SYMPTOM_KEYS.includes(key));

    expect([...placed].sort()).toEqual([...offered].sort());
    expect(new Set(placed).size).toBe(placed.length);
  });

  it('keeps retired symptoms known (so older entries still show) but out of every area', () => {
    expect(RETIRED_SYMPTOM_KEYS).toEqual(['sleep']);
    for (const key of RETIRED_SYMPTOM_KEYS) {
      expect(SYMPTOM_KEYS).toContain(key);
      expect(BODY_ZONES.flatMap((zone) => zone.symptoms)).not.toContain(key);
    }
  });

  it('has exactly three areas, with no catch-all', () => {
    expect(BODY_ZONES.map((zone) => zone.key)).toEqual(['throat', 'chest', 'tummy']);
  });

  it('keeps every area to a short list', () => {
    for (const zone of BODY_ZONES) {
      expect(zone.symptoms.length).toBeGreaterThan(0);
      expect(zone.symptoms.length).toBeLessThanOrEqual(5);
    }
    expect(SYMPTOM_ITEMS).toHaveLength(14);
  });

  it('puts the new tummy symptoms under Tummy', () => {
    expect(zoneSymptoms('tummy')).toEqual(['stomach_pain', 'feeling_full', 'constipation']);
    expect(zoneLabel('tummy')).toBe('Tummy');
  });
});
