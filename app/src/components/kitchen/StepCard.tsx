import {
  Blend,
  ChefHat,
  Droplets,
  Flame,
  type LucideIcon,
  Slice,
  Thermometer,
  Timer,
  Utensils,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { type StepKind, stepKind, stepTime, stepTone } from '@/lib/recipeSteps';
import { radius, space, useColors } from '@/theme';

const ICONS: Record<StepKind, LucideIcon> = {
  wait: Timer,
  serve: Utensils,
  bake: Thermometer,
  heat: Flame,
  chop: Slice,
  stir: Blend,
  add: Droplets,
  other: ChefHat,
};

type Props = {
  /** 0-based. */
  index: number;
  total: number;
  text: string;
};

/**
 * One step of a recipe as a card (Figma row 29e, 29e3): an icon that follows the step's verb on a soft colour,
 * "Step 2 of 6", the instruction in large type that is easy to read at the stove, and a time chip when the step names
 * a time. Give it a parent that lets it grow to the tallest card in the row.
 */
export function StepCard({ index, total, text }: Props) {
  const colors = useColors();
  const Icon = ICONS[stepKind(text)];
  const tone = stepTone(index);
  const time = stepTime(text);
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.top}>
        <View style={[styles.tile, { backgroundColor: colors[tone.tint] }]}>
          <Icon size={28} color={colors[tone.ink]} strokeWidth={2} />
        </View>
        {time && (
          <View style={[styles.chip, { backgroundColor: colors.surface2 }]}>
            <Timer size={16} color={colors.ink} strokeWidth={2} />
            <AppText variant="label">{time}</AppText>
          </View>
        )}
      </View>
      <AppText variant="label" color="inkMuted">{`Step ${index + 1} of ${total}`}</AppText>
      <AppText variant="lead">{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: radius.lg, padding: space.s2 + 4, gap: space.s1 + 4 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tile: { width: 56, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: radius.pill,
  },
});
