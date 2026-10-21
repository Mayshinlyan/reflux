import { useState } from 'react';

import { Button } from '@/components/Button';
import { ConditionChoices } from '@/components/ConditionChoices';
import { type ConditionKey, pickCondition } from '@/constants/conditions';
import { useSettings } from '@/db/DatabaseProvider';
import { logger } from '@/lib/logger';

import { StepLayout } from './StepLayout';

type Props = {
  /** What was picked the last time they were here (coming back), or nothing. */
  initial: readonly ConditionKey[];
  onNext: (conditions: ConditionKey[]) => void;
};

/**
 * What's been bothering them, pick all that apply (Figma 01c). Nothing is picked to start, and Continue waits for a
 * choice; "I'm not sure yet" is a choice.
 */
export function ConditionStep({ initial, onNext }: Props) {
  const { update } = useSettings();
  const [conditions, setConditions] = useState<ConditionKey[]>([...initial]);
  const [saveFailed, setSaveFailed] = useState(false);

  const next = () => {
    try {
      update('conditions', conditions);
    } catch (error) {
      logger.error('saveCondition', error);
      setSaveFailed(true);
      return;
    }
    onNext(conditions);
  };

  return (
    <StepLayout
      title="What's bothering you?"
      subtitle="Pick all that apply. Not sure? That's fine too."
      saveFailed={saveFailed}
      footer={<Button label="Continue" onPress={next} disabled={conditions.length === 0} />}>
      <ConditionChoices
        variant="feeling"
        value={conditions}
        onToggle={(key) => setConditions((current) => pickCondition(current, key))}
      />
    </StepLayout>
  );
}
