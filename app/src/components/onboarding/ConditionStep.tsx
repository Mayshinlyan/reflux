import { useState } from 'react';

import { Button } from '@/components/Button';
import { ConditionChoices } from '@/components/ConditionChoices';
import { useSettings } from '@/db/DatabaseProvider';
import { logger } from '@/lib/logger';

import { StepLayout } from './StepLayout';

/** What the user is managing, one pick (Figma 01c). */
export function ConditionStep({ onNext }: { onNext: () => void }) {
  const { settings, update } = useSettings();
  const [condition, setCondition] = useState(settings.condition);
  const [saveFailed, setSaveFailed] = useState(false);

  const next = () => {
    try {
      update('condition', condition);
    } catch (error) {
      logger.error('saveCondition', error);
      setSaveFailed(true);
      return;
    }
    onNext();
  };

  return (
    <StepLayout
      title="What would you like to manage?"
      subtitle="We'll tailor what you track. You can change this later."
      saveFailed={saveFailed}
      footer={<Button label="Continue" onPress={next} />}>
      <ConditionChoices value={condition} onChoose={setCondition} />
    </StepLayout>
  );
}
