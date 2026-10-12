import { useState } from 'react';

import { Button } from '@/components/Button';
import { SymptomZones } from '@/components/SymptomZones';
import { SYMPTOM_KEYS, type SymptomKey } from '@/constants/symptomItems';
import { useSettings } from '@/db/DatabaseProvider';
import { logger } from '@/lib/logger';

import { StepLayout } from './StepLayout';

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
      <SymptomZones selected={selected} onToggle={toggle} />
    </StepLayout>
  );
}
