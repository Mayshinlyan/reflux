import { useState } from 'react';

import { Button } from '@/components/Button';
import { ConditionChoices } from '@/components/ConditionChoices';
import { toggleCondition } from '@/constants/conditions';
import { useSettings } from '@/db/DatabaseProvider';
import { logger } from '@/lib/logger';

import { StepLayout } from './StepLayout';

/** What the user is managing, pick all that apply (Figma 01c). */
export function ConditionStep({ onNext }: { onNext: () => void }) {
  const { settings, update } = useSettings();
  const [conditions, setConditions] = useState(settings.conditions);
  const [saveFailed, setSaveFailed] = useState(false);

  const next = () => {
    try {
      update('conditions', conditions);
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
      subtitle="Pick all that apply. We'll tailor what you track. You can change this later."
      saveFailed={saveFailed}
      footer={<Button label="Continue" onPress={next} />}>
      <ConditionChoices
        value={conditions}
        onToggle={(key) => setConditions((current) => toggleCondition(current, key))}
      />
    </StepLayout>
  );
}
