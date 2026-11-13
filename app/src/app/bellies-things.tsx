import { Lock } from 'lucide-react-native';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { BellieHat } from '@/components/completion/BellieHat';
import { Screen } from '@/components/Screen';
import { useDb } from '@/db/DatabaseProvider';
import { listCheckIns } from '@/db/repositories/checkIns';
import { isOwned, SHELF, type ShelfKey } from '@/lib/completionFlow';
import { summarizeCheckIns } from '@/lib/streak';
import { currentTimeZone } from '@/lib/time';
import { cardEdge, radius, space, useColors } from '@/theme';

/** Bellie's things (Figma G4d): the gifts from check-ins, and the days the next ones unlock. */
export default function BelliesThingsScreen() {
  const colors = useColors();
  const db = useDb();
  const days = useMemo(
    () => summarizeCheckIns(listCheckIns(db), new Date(), currentTimeZone()).checkInDays,
    [db],
  );

  const art = (key: ShelfKey) => {
    if (key === 'hat') return <BellieHat size={72} />;
    if (key === 'glasses') {
      return (
        <Svg width={90} height={40} viewBox="0 0 90 40">
          <Circle cx={22} cy={20} r={15} fill="none" stroke={colors.ink} strokeWidth={3} />
          <Circle cx={68} cy={20} r={15} fill="none" stroke={colors.ink} strokeWidth={3} />
          <Rect x={37} y={18} width={16} height={3} rx={1.5} fill={colors.ink} />
        </Svg>
      );
    }
    // Only the hat and glasses are drawn so far; the scarf and the surprise stay a lock until their gifts are made.
    return <Lock size={32} color={colors.inkMuted} strokeWidth={2} />;
  };

  return (
    <Screen>
      <BackHeader />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AppText variant="display" accessibilityRole="header">
          Bellie&apos;s things
        </AppText>
        <AppText color="inkSoft" style={styles.sub}>
          Gifts from your check-ins
        </AppText>

        <View style={styles.grid}>
          {SHELF.map((item) => {
            const owned = isOwned(item.key, days);
            return (
              <View
                key={item.key}
                accessible
                accessibilityLabel={`${item.name}, ${owned ? `got it on day ${item.day}` : `unlocks on day ${item.day}`}`}
                style={[styles.tile, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
                <View style={styles.art}>{art(item.key)}</View>
                <AppText variant="bodyEm" color={owned ? 'ink' : 'inkSoft'}>
                  {item.name}
                </AppText>
                <AppText variant="caption" color={owned ? 'inkSoft' : 'inkMuted'}>
                  {owned ? `Got it on day ${item.day}` : `Unlocks on day ${item.day}`}
                </AppText>
              </View>
            );
          })}
        </View>
        <AppText variant="caption" color="inkMuted" style={styles.note}>
          A new gift about once a week.
        </AppText>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.s5 },
  sub: { marginTop: space.s1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2, marginTop: space.s3 },
  tile: { width: '47.5%', borderRadius: radius.lg, padding: space.s2, gap: 2 },
  art: { height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: space.s1 },
  note: { marginTop: space.s3, textAlign: 'center' },
});
