import { BODY_ZONES, MAP_ZONES, TORSO_IMAGE, zoneLabel, zoneSymptoms } from '../bodyZones';
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
    expect(SYMPTOM_ITEMS).toHaveLength(13);
  });

  it('puts the new tummy symptoms under Tummy', () => {
    expect(zoneSymptoms('tummy')).toEqual(['stomach_pain', 'feeling_full', 'constipation']);
    expect(zoneLabel('tummy')).toBe('Tummy');
  });

  it('draws each tappable area inside the torso image and never overlapping another', () => {
    for (const zone of MAP_ZONES) {
      expect(zone.x).toBeGreaterThanOrEqual(0);
      expect(zone.y).toBeGreaterThanOrEqual(0);
      expect(zone.x + zone.width).toBeLessThanOrEqual(TORSO_IMAGE.width);
      expect(zone.y + zone.height).toBeLessThanOrEqual(TORSO_IMAGE.height);
    }
    for (const [i, a] of MAP_ZONES.entries()) {
      for (const b of MAP_ZONES.slice(i + 1)) {
        const overlaps =
          a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('has an area for every map zone key', () => {
    const keys = BODY_ZONES.map((zone) => zone.key);
    for (const zone of MAP_ZONES) expect(keys).toContain(zone.key);
  });
});
