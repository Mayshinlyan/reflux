import { Check, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  onPress: () => void;
  /**
   * Omit for a plain navigation card (chevron). Pass true/false for a pick-one card (radio):
   * selected = clay tint fill, never a border. Set `multiple` for pick-any cards (checkbox).
   */
  selected?: boolean;
  multiple?: boolean;
};

/** Figma "Choice card": icon circle, title + subtitle, then a chevron, a radio or a checkbox. */
export function ChoiceCard({ title, subtitle, icon: Icon, onPress, selected, multiple }: Props) {
  const colors = useColors();
  const isChoice = selected !== undefined;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={isChoice ? (multiple ? 'checkbox' : 'radio') : 'button'}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityState={isChoice ? { checked: selected } : undefined}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: selected ? colors.clayTint : colors.surface, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={[styles.icon, { backgroundColor: selected ? colors.surface : colors.surface2 }]}>
        <Icon size={22} color={colors.ink} strokeWidth={2} />
      </View>
      <View style={styles.text}>
        <AppText variant="bodyEm">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" color="inkSoft">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {isChoice ? (
        // The radio ring is a functional stroke; selected it fills with clay.
        <View
          style={[
            styles.radio,
            selected ? { backgroundColor: colors.clay } : { borderWidth: 1.5, borderColor: colors.inkSoft },
          ]}>
          {selected && <Check size={14} color={colors.surface} strokeWidth={3} />}
        </View>
      ) : (
        <ChevronRight size={20} color={colors.inkSoft} strokeWidth={2} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: radius.lg },
  icon: { width: 42, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  radio: { width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
