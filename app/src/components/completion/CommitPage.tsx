import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { PATTERN_DAYS } from '@/lib/completionFlow';
import type { CheckInSummary } from '@/lib/streak';
import { cardEdge, radius, space, useColors } from '@/theme';

import { CompletionLayout } from './CompletionLayout';
import { HoppingBelly } from './HoppingBelly';

export const GOALS = [
  { days: 7, word: 'Good' },
  { days: 14, word: 'Great' },
  { days: 30, word: 'Incredible' },
] as const;
export type Goal = (typeof GOALS)[number]['days'];

type GoalProps = {
  picked: Goal | null;
  onPick: (goal: Goal) => void;
  onCommit: () => void;
  onSkip: () => void;
};

/** Screen 3, goal version (Figma G3a/G3b): pick how many check-in days to aim for. Always skippable. */
export function CommitGoalPage({ picked, onPick, onCommit, onSkip }: GoalProps) {
  const colors = useColors();
  return (
    <CompletionLayout
      top
      action={{ label: 'Commit to my goal', onPress: onCommit, disabled: picked === null }}
      quiet={{ label: 'Not now', onPress: onSkip }}>
      <AppText variant="display" accessibilityRole="header" style={styles.goalTitle}>
        Commit to finding your pattern!
      </AppText>

      <View style={[styles.goals, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
        {GOALS.map((goal, index) => {
          const selected = picked === goal.days;
          return (
            <Pressable
              key={goal.days}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${goal.days} check-in days, ${goal.word}`}
              onPress={() => onPick(goal.days)}
              style={[
                styles.goal,
                index > 0 && !selected && { borderTopWidth: 1, borderTopColor: colors.hairline },
                selected && { backgroundColor: colors.sageTint, borderWidth: 1, borderColor: colors.sageInk },
              ]}>
              <AppText variant="bodyEm">{`${goal.days} check-in days`}</AppText>
              <AppText variant="small" color={selected ? 'sageInk' : 'inkSoft'}>
                {goal.word}
              </AppText>
              {selected && (
                <View style={[styles.badge, { backgroundColor: colors.cta }]}>
                  <Check size={16} color={colors.ctaInk} strokeWidth={3} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.bellieRow}>
        <Belly size={112} />
        <View style={styles.bubbleWrap}>
          <View style={[styles.tail, { backgroundColor: colors.surface, borderColor: colors.edge }]} />
          <View style={[styles.bubble, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
            <AppText variant="small">
              {picked === null
                ? 'Goals help Bellie find your pattern!'
                : 'Every check-in gives Bellie more to learn from.'}
            </AppText>
          </View>
        </View>
      </View>
    </CompletionLayout>
  );
}

/** Screen 3, progress version (Figma G3c): day 3, seven bars toward the first pattern. */
export function CommitProgressPage({
  summary,
  onContinue,
}: {
  summary: CheckInSummary;
  onContinue: () => void;
}) {
  const colors = useColors();
  const done = Math.min(summary.checkInDays, PATTERN_DAYS);
  const left = PATTERN_DAYS - done;
  const { meals, symptoms, doses } = summary.counts;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return (
    <CompletionLayout top action={{ label: 'Keep going', onPress: onContinue }}>
      <View style={styles.progressBellie}>
        <HoppingBelly size={112} />
      </View>
      <AppText variant="display" accessibilityRole="header" style={styles.progressTitle}>
        {`${left} days left to your first pattern`}
      </AppText>
      <AppText color="inkSoft" style={styles.progressLine}>
        {`Get free report by the end of ${PATTERN_DAYS} days!`}
      </AppText>

      <View
        style={styles.bars}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${done} of ${PATTERN_DAYS} days`}
        accessibilityValue={{ min: 0, max: PATTERN_DAYS, now: done }}>
        {Array.from({ length: PATTERN_DAYS }, (_, i) => (
          <View key={i} style={[styles.bar, { backgroundColor: i < done ? colors.cta : colors.surface2 }]} />
        ))}
      </View>

      <View style={[styles.sofar, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
        <AppText variant="label" color="inkSoft">
          SO FAR
        </AppText>
        <AppText style={styles.sofarLine}>
          {`${plural(meals, 'meal', 'meals')} · ${plural(symptoms, 'symptom log', 'symptom logs')} · ${plural(doses, 'dose', 'doses')}`}
        </AppText>
      </View>
    </CompletionLayout>
  );
}

const styles = StyleSheet.create({
  goalTitle: { textAlign: 'center', marginTop: space.s4 },
  goals: { alignSelf: 'stretch', borderRadius: radius.lg, marginTop: space.s4 },
  goal: {
    height: 64,
    paddingHorizontal: space.s3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
  },
  badge: {
    position: 'absolute',
    right: -6,
    top: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellieRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: space.s3,
    gap: space.s1,
  },
  bubbleWrap: { flex: 1, justifyContent: 'center' },
  bubble: { borderRadius: radius.lg, padding: space.s2 },
  // A square turned 45 degrees, half hidden behind the bubble, points at Bellie.
  tail: {
    position: 'absolute',
    left: -6,
    top: '50%',
    marginTop: -7,
    width: 14,
    height: 14,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    transform: [{ rotate: '45deg' }],
  },
  progressBellie: { marginTop: space.s3 },
  progressTitle: { textAlign: 'center', marginTop: space.s3 },
  progressLine: { textAlign: 'center', marginTop: space.s1 },
  bars: { alignSelf: 'stretch', flexDirection: 'row', gap: 8, marginTop: space.s4, paddingHorizontal: 6 },
  bar: { flex: 1, height: 12, borderRadius: 6 },
  sofar: {
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    padding: space.s3,
    marginTop: space.s3,
    gap: space.s1,
  },
  sofarLine: { marginTop: 4 },
});
