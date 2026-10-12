import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { SymptomChip } from '@/components/SymptomChip';
import { BODY_ZONES } from '@/constants/bodyZones';
import { SYMPTOM_ITEMS, SYMPTOM_KEYS, type SymptomKey } from '@/constants/symptomItems';
import { useSettings } from '@/db/DatabaseProvider';
import { logger } from '@/lib/logger';
import { space } from '@/theme';

import { StepLayout } from './StepLayout';

const labelOf = (key: SymptomKey) => SYMPTOM_ITEMS.find((item) => item.key === key)?.label ?? key;

/** The symptoms they usually feel, any number (Figma 01d). Skip lives in the top bar, set by the stepper. */
export function SymptomsStep({ onNext }: { onNext: () => void }) {
  const { settings, update } = useSettings();
  const [selected, setSelected] = useState<ReadonlySet<SymptomKey>>(new Set(settings.usualSymptoms));
  const [saveFailed, setSaveFailed] = useState(false);

  const toggle = (key: SymptomKey) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const next = () => {
    try {
      // In catalog order, so the saved list doesn't depend on tap order.
      update(
        'usualSymptoms',
        SYMPTOM_KEYS.filter((key) => selected.has(key)),
      );
    } catch (error) {
      logger.error('saveUsualSymptoms', error);
      setSaveFailed(true);
      return;
    }
    onNext();
  };

  return (
    <StepLayout
      title="What do you usually feel?"
      subtitle="Pick any that apply. We'll show them first when you log."
      saveFailed={saveFailed}
      footer={<Button label="Continue" onPress={next} />}>
      {BODY_ZONES.map((zone, index) => (
        <View key={zone.key} style={index > 0 && styles.zone}>
          <AppText variant="section">{zone.label}</AppText>
          <View style={styles.chips}>
            {zone.symptoms.map((key) => (
              <SymptomChip
                key={key}
                label={labelOf(key)}
                selected={selected.has(key)}
                onToggle={() => toggle(key)}
              />
            ))}
          </View>
        </View>
      ))}
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  zone: { marginTop: space.s3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1, marginTop: 12 },
});
