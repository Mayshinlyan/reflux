import { orderedZones } from '../bodyZones';
import {
  conditionsForAnalysis,
  legacyCondition,
  managingLine,
  readConditions,
  suggestedSymptoms,
  toggleCondition,
} from '../conditions';

describe('conditions', () => {
  it('"Not sure yet" clears the rest, any other pick clears it, and the list is never empty', () => {
    expect(toggleCondition(['acid_reflux', 'lpr'], 'unsure')).toEqual(['unsure']);
    expect(toggleCondition(['unsure'], 'lpr')).toEqual(['lpr']);
    expect(toggleCondition(['lpr'], 'acid_reflux')).toEqual(['acid_reflux', 'lpr']);
    expect(toggleCondition(['acid_reflux', 'lpr'], 'lpr')).toEqual(['acid_reflux']);
    expect(toggleCondition(['gastritis'], 'gastritis')).toEqual(['unsure']);
  });

  it('describes what you are managing', () => {
    expect(managingLine(['unsure'])).toBe('Just tracking for now');
    expect(managingLine(['gastritis'])).toBe('Managing gastritis');
    expect(managingLine(['acid_reflux', 'lpr'])).toBe('Managing acid reflux and silent reflux');
    expect(managingLine(['acid_reflux', 'lpr', 'gastritis'])).toBe(
      'Managing acid reflux, silent reflux and gastritis',
    );
  });

  it('keeps "Not sure yet" away from the relay', () => {
    expect(conditionsForAnalysis(['unsure'])).toEqual([]);
    expect(conditionsForAnalysis(['lpr', 'gastritis'])).toEqual(['lpr', 'gastritis']);
  });

  it('suggests the symptoms of every chosen condition once', () => {
    expect(suggestedSymptoms(['unsure'])).toEqual([]);
    expect(suggestedSymptoms(['acid_reflux', 'gastritis'])).toEqual([
      'heartburn',
      'burping',
      'stomach_pain',
      'feeling_full',
    ]);
  });

  it('maps the old gerd choice to acid reflux', () => {
    expect(legacyCondition('gerd')).toBe('acid_reflux');
    expect(legacyCondition('lpr')).toBe('lpr');
    expect(legacyCondition('flu')).toBeNull();
  });

  it('makes a stored list safe: known keys once each, "Not sure yet" only alone, null when unusable', () => {
    expect(readConditions(['lpr', 'acid_reflux'])).toEqual(['acid_reflux', 'lpr']);
    expect(readConditions(['lpr', 'bogus', 'lpr'])).toEqual(['lpr']);
    expect(readConditions(['unsure', 'lpr'])).toEqual(['lpr']);
    expect(readConditions(['unsure'])).toEqual(['unsure']);
    expect(readConditions([])).toBeNull();
    expect(readConditions(['bogus'])).toBeNull();
    expect(readConditions('gerd')).toBeNull();
    expect(readConditions({})).toBeNull();
  });

  it('lists the body areas the conditions affect first', () => {
    const keys = (conditions: Parameters<typeof orderedZones>[0]) =>
      orderedZones(conditions).map((zone) => zone.key);
    expect(keys(['unsure'])).toEqual(['throat', 'chest', 'tummy']);
    expect(keys(['gastritis'])).toEqual(['tummy', 'throat', 'chest']);
    expect(keys(['acid_reflux', 'lpr'])).toEqual(['chest', 'throat', 'tummy']);
  });
});
