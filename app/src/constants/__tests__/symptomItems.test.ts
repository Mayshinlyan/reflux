import {
  cleanCustomSymptom,
  customSymptomLabel,
  isCustomSymptom,
  MAX_CUSTOM_SYMPTOM,
  symptomKeyFromText,
} from '../symptomItems';

describe('symptoms you type', () => {
  it('tidies what was typed: trimmed, inner spaces collapsed, cut to the limit', () => {
    expect(cleanCustomSymptom('  Jaw \n  tightness ')).toBe('Jaw tightness');
    expect(cleanCustomSymptom('x'.repeat(100))).toHaveLength(MAX_CUSTOM_SYMPTOM);
    expect(cleanCustomSymptom('   ')).toBe('');
  });

  it('turns text into a custom key, and back into its label', () => {
    const key = symptomKeyFromText(' Hiccups ');
    expect(key).toBe('custom:Hiccups');
    expect(isCustomSymptom(key as string)).toBe(true);
    expect(customSymptomLabel(key as string)).toBe('Hiccups');
    expect(customSymptomLabel('heartburn')).toBe('heartburn');
  });

  it('picks the built-in symptom when the text names one, ignoring capitals', () => {
    expect(symptomKeyFromText('heartburn')).toBe('heartburn');
    expect(symptomKeyFromText('NAGGING COUGH')).toBe('cough');
  });

  it('does not match a retired symptom, and returns null for nothing usable', () => {
    expect(symptomKeyFromText('Trouble sleeping')).toBe('custom:Trouble sleeping');
    expect(symptomKeyFromText('   ')).toBeNull();
  });
});
