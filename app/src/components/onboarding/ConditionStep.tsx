import { Activity } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { ChoiceCard } from '@/components/ChoiceCard';
import { CONDITIONS } from '@/constants/conditions';
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
      <View accessibilityRole="radiogroup" style={styles.list}>
        {CONDITIONS.map((item) => (
          <ChoiceCard
            key={item.key}
            icon={Activity}
            title={item.label}
            subtitle={item.hint}
            selected={item.key === condition}
            onPress={() => setCondition(item.key)}
          />
        ))}
      </View>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
});
