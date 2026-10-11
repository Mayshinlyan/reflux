import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  /** The dates shown, e.g. "Oct 4 – 10". Tapping it opens the calendar. */
  label: string;
  onPressLabel: () => void;
  /** Hide both arrows, for all time and a range picked by hand. */
  arrows?: boolean;
  onBack?: () => void;
  onForward?: () => void;
  /** Dimmed and inert when there is nothing earlier or later to go to. */
  canBack?: boolean;
  canForward?: boolean;
  /** What the arrows move by, for screen readers: "week" gives "Previous week" and "Next week". */
  unit?: string;
};

const SIZE = 32;

/** Figma "Range stepper": `‹ Oct 4 – 10 ›` on a `surface` pill. The arrows step, the dates open the calendar. */
export function RangeStepper({
  label,
  onPressLabel,
  arrows = true,
  onBack,
  onForward,
  canBack = true,
  canForward = true,
  unit = 'period',
}: Props) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.pill,
        arrows ? styles.withArrows : styles.labelOnly,
        { backgroundColor: colors.surface },
      ]}>
      {arrows && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Previous ${unit}`}
          accessibilityState={{ disabled: !canBack }}
          disabled={!canBack}
          onPress={onBack}
          hitSlop={6}
          style={[styles.arrow, !canBack && styles.dim]}>
          <ChevronLeft size={20} color={colors.ink} strokeWidth={2.2} />
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens the calendar to pick dates"
        onPress={onPressLabel}
        style={styles.label}>
        <AppText variant="label">{label}</AppText>
      </Pressable>
      {arrows && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Next ${unit}`}
          accessibilityState={{ disabled: !canForward }}
          disabled={!canForward}
          onPress={onForward}
          hitSlop={6}
          style={[styles.arrow, !canForward && styles.dim]}>
          <ChevronRight size={20} color={colors.ink} strokeWidth={2.2} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', height: 42, borderRadius: radius.pill },
  withArrows: { padding: 5, gap: 4 },
  labelOnly: { paddingHorizontal: 16 },
  arrow: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dim: { opacity: 0.3 },
  label: { minHeight: SIZE, justifyContent: 'center', paddingHorizontal: 2 },
});
