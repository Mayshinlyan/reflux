import { Pressable, StyleSheet, View } from 'react-native';

import { MAX_SCORE } from '@/constants/symptomItems';
import { minTouchTarget, radius, space, typography, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  label: string;
  /** Severity 1–5 when selected, undefined when not. */
  score?: number;
  onToggle?: () => void;
  onScoreChange?: (score: number) => void;
  /** Read-only display (e.g. the History detail sheet). */
  readOnly?: boolean;
};

const MIN_SCORE = 1;

/**
 * A symptom chip. Tapping toggles it; once selected it shows five severity dots that can
 * be tapped directly. Screen-reader users adjust severity with swipe up/down.
 */
export function SymptomChip({ label, score, onToggle, onScoreChange, readOnly }: Props) {
  const colors = useColors();
  const selected = score !== undefined;

  const setScore = (next: number) => onScoreChange?.(Math.min(MAX_SCORE, Math.max(MIN_SCORE, next)));

  // A read-only chip is just information: read it as text ("Heartburn, severity 3 of 5"),
  // not as a dimmed checkbox.
  const roleProps = readOnly
    ? ({
        accessible: true,
        accessibilityRole: 'text',
        accessibilityLabel: selected ? `${label}, severity ${score} of ${MAX_SCORE}` : label,
      } as const)
    : ({
        accessibilityRole: selected ? 'adjustable' : 'checkbox',
        accessibilityLabel: label,
        accessibilityState: { checked: selected },
        accessibilityValue: selected ? { text: `severity ${score} of ${MAX_SCORE}` } : undefined,
      } as const);

  return (
    <Pressable
      disabled={readOnly}
      onPress={onToggle}
      {...roleProps}
      accessibilityActions={
        selected && !readOnly
          ? [{ name: 'increment' }, { name: 'decrement' }, { name: 'activate', label: 'Remove' }]
          : undefined
      }
      onAccessibilityAction={(event) => {
        if (!selected || score === undefined) return;
        if (event.nativeEvent.actionName === 'increment') setScore(score + 1);
        if (event.nativeEvent.actionName === 'decrement') setScore(score - 1);
        if (event.nativeEvent.actionName === 'activate') onToggle?.();
      }}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.sageTint, borderColor: colors.sage }
          : { backgroundColor: colors.surface, borderColor: colors.hairline },
      ]}>
      <AppText style={[styles.label, { color: selected ? colors.sageInk : colors.ink }]}>{label}</AppText>
      {selected && (
        <View style={styles.dots} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {Array.from({ length: MAX_SCORE }, (_, index) => {
            const value = index + 1;
            const on = value <= (score ?? 0);
            return (
              <Pressable
                key={value}
                disabled={readOnly}
                onPress={() => setScore(value)}
                hitSlop={{ top: 12, bottom: 12, left: 2, right: 2 }}
                style={[
                  styles.dot,
                  on
                    ? { backgroundColor: colors.sageInk, borderColor: colors.sageInk }
                    : { backgroundColor: 'rgba(255,255,255,0.6)', borderColor: colors.sage },
                ]}
              />
            );
          })}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    minHeight: minTouchTarget,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  label: { ...typography.bodyEm, fontSize: 15, lineHeight: 20 },
  dots: { flexDirection: 'row', gap: 6, marginLeft: 2 },
  dot: { width: 18, height: 18, borderRadius: radius.pill, borderWidth: 1.5 },
});
