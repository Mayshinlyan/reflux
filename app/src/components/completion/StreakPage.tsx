import { Check } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion, ZoomIn } from 'react-native-reanimated';
import Svg, { Ellipse, Rect } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { streakHeadline } from '@/lib/completionFlow';
import { addDays, localDayKey } from '@/lib/localDay';
import { mondayOf, type CheckInSummary } from '@/lib/streak';
import { currentTimeZone } from '@/lib/time';
import { cardEdge, radius, space, useColors } from '@/theme';

import { CompletionLayout } from './CompletionLayout';
import { Confetti } from './Confetti';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Screen 2 (Figma G2): the first check-in of the day. A cozy streak, never a loss: a gap just says welcome back. */
export function StreakPage({ summary, onContinue }: { summary: CheckInSummary; onContinue: () => void }) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  const head = streakHeadline(summary);
  const today = localDayKey(new Date().toISOString(), currentTimeZone());
  const monday = mondayOf(today);
  const logged = new Set(summary.weekDays);

  return (
    <CompletionLayout
      backdrop={<Confetti count={6} />}
      action={{ label: 'Continue', onPress: onContinue }}
      top>
      <Animated.View
        entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)}
        style={[styles.disc, { backgroundColor: colors.sageTint }]}
        accessible
        accessibilityLabel={head.big ? `${head.big} ${head.title}` : head.title}>
        {head.big ? (
          <>
            <Svg width={44} height={46} viewBox="0 0 44 46" style={styles.sprout}>
              <Rect x={20} y={22} width={4} height={24} rx={2} fill={colors.sageInk} />
              <Ellipse cx={13} cy={15} rx={13} ry={9} fill={colors.good} rotation={-28} origin="13, 15" />
              <Ellipse cx={31} cy={20} rx={13} ry={9} fill={colors.good} rotation={28} origin="31, 20" />
            </Svg>
            {/* A one-off display numeral, larger than the type scale goes. */}
            <AppText variant="hero" style={styles.number}>
              {head.big}
            </AppText>
          </>
        ) : (
          <Belly size={112} />
        )}
      </Animated.View>

      <AppText variant="display" accessibilityRole="header" style={styles.title}>
        {head.title}
      </AppText>
      <AppText color="inkSoft" style={styles.line}>
        {head.subtitle}
      </AppText>

      <View style={[styles.week, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
        {LETTERS.map((letter, index) => {
          const day = addDays(monday, index);
          const done = logged.has(day);
          const isToday = day === today;
          return (
            <View
              key={day}
              style={styles.dayCol}
              accessible
              accessibilityLabel={`${letter}, ${done ? 'checked in' : 'no check-in'}`}>
              <AppText variant="label" color={isToday ? 'ink' : 'inkSoft'}>
                {letter}
              </AppText>
              <View style={[styles.ring, isToday && { borderColor: colors.sageInk }]}>
                <View
                  style={[
                    styles.dot,
                    done
                      ? { backgroundColor: colors.good }
                      : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.edge },
                  ]}>
                  {done && <Check size={16} color={colors.surface} strokeWidth={3} />}
                </View>
              </View>
            </View>
          );
        })}
      </View>
      <AppText variant="caption" color="inkMuted" style={styles.note}>
        Any log counts. Rest days are fine.
      </AppText>
    </CompletionLayout>
  );
}

const styles = StyleSheet.create({
  disc: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.s5,
  },
  sprout: { position: 'absolute', top: -20 },
  number: { transform: [{ scale: 1.8 }], marginTop: space.s2 },
  title: { marginTop: space.s3, textAlign: 'center' },
  line: { marginTop: space.s1, textAlign: 'center' },
  week: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    paddingVertical: space.s2,
    paddingHorizontal: space.s1,
    marginTop: space.s4,
  },
  dayCol: { flex: 1, alignItems: 'center', gap: space.s1 },
  ring: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  note: { marginTop: space.s2, textAlign: 'center' },
});
