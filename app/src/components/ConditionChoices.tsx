import { Activity } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { CONDITIONS, type ConditionKey } from '@/constants/conditions';

import { ChoiceCard } from './ChoiceCard';

type Props = {
  value: readonly ConditionKey[];
  onToggle: (condition: ConditionKey) => void;
};

/** The conditions to pick from, pick all that apply (onboarding and the Profile's condition sheet). */
export function ConditionChoices({ value, onToggle }: Props) {
  return (
    <View style={styles.list}>
      {CONDITIONS.map((item) => (
        <ChoiceCard
          key={item.key}
          icon={Activity}
          title={item.label}
          subtitle={item.hint}
          multiple
          selected={value.includes(item.key)}
          onPress={() => onToggle(item.key)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
});
