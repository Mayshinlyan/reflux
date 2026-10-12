import { Activity } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { CONDITIONS, type ConditionKey } from '@/constants/conditions';

import { ChoiceCard } from './ChoiceCard';

type Props = {
  value: ConditionKey;
  onChoose: (condition: ConditionKey) => void;
};

/** The conditions to pick from, one choice card each (onboarding and the Profile's condition sheet). */
export function ConditionChoices({ value, onChoose }: Props) {
  return (
    <View accessibilityRole="radiogroup" style={styles.list}>
      {CONDITIONS.map((item) => (
        <ChoiceCard
          key={item.key}
          icon={Activity}
          title={item.label}
          subtitle={item.hint}
          selected={item.key === value}
          onPress={() => onChoose(item.key)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
});
