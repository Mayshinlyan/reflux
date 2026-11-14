import * as Haptics from 'expo-haptics';
import { useLocalSearchParams } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { Belly } from '@/components/Belly';
import { useBellieStage } from '@/components/belly/BellieStageContext';
import { ITEM_ART } from '@/components/belly/items';
import { GiftBox } from '@/components/completion/GiftBox';
import { Screen } from '@/components/Screen';
import { useTourTarget } from '@/components/tour/TourContext';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { listCheckIns } from '@/db/repositories/checkIns';
import {
  daysUntil,
  ITEM_KEYS,
  ITEM_NAME,
  ITEM_UNLOCK_DAY,
  type ItemKey,
  isOwned,
  moreDays,
  takeOff,
  unlockLine,
  wearItem,
  wornNow,
} from '@/lib/bellieItems';
import { summarizeCheckIns } from '@/lib/streak';
import { currentTimeZone } from '@/lib/time';
import { cardEdge, radius, selectedEdge, selectedFill, space, useColors } from '@/theme';

const TILE = 84;
const STAGE_BELLIE = 264;

/**
 * Customize Bellie (Figma G12): Bellie on a stage and a row of things to put on it, which stack (one per spot: head,
 * face, neck; the headphones go with everything). The row scrolls sideways: what you own first, in order from the head
 * down, then the locked ones together, soonest first, each saying how many check-in days away it is. A tap puts an
 * item on or takes it off, and takes whatever shared its spot off. It is saved at once.
 * In development builds `?preview=60` pretends to have that many check-in days, to see everything unlocked.
 */
export default function CustomizeBellieScreen() {
  const colors = useColors();
  const db = useDb();
  const { settings, update } = useSettings();
  const stage = useBellieStage();
  // The app tour spotlights the row of gifts.
  const giftRow = useTourTarget('giftRow');
  const { preview, gift } = useLocalSearchParams<{ preview?: string; gift?: string }>();

  const days = useMemo(() => {
    const pretend = __DEV__ ? Number(preview) : NaN;
    if (Number.isInteger(pretend) && pretend >= 1) return pretend;
    return summarizeCheckIns(listCheckIns(db), new Date(), currentTimeZone()).checkInDays;
  }, [db, preview]);

  // Every item is a gift on its day. Until it has been opened, Customize Bellie shows a gift box in its place. Pretend
  // days (`?preview=`) skip this unless `&gift=1` asks for it.
  const boxed = (key: ItemKey) =>
    isOwned(key, days) && !settings.giftsSeen.includes(ITEM_UNLOCK_DAY[key]) && (!preview || gift === '1');

  const worn = wornNow(settings.bellieWorn, settings.bellieHat);
  const owned = ITEM_KEYS.filter((key) => isOwned(key, days));
  const locked = ITEM_KEYS.filter((key) => !isOwned(key, days)).sort(
    (a, b) => ITEM_UNLOCK_DAY[a] - ITEM_UNLOCK_DAY[b],
  );

  // The line under the row: how many more check-in days a locked item needs. It starts on the next one to unlock; tapping
  // another locked tile reads its own.
  const [peek, setPeek] = useState<ItemKey | null>(null);
  const peeked = peek && locked.includes(peek) ? peek : (locked[0] ?? null);

  const save = (next: ItemKey[]) => {
    Haptics.selectionAsync().catch(() => {});
    // The old yes-or-no hat is folded into the list the first time anything is changed.
    if (settings.bellieHat) update('bellieHat', false);
    update('bellieWorn', next);
  };
  const toggle = (key: ItemKey) => save(worn.includes(key) ? takeOff(worn, key) : wearItem(worn, key));

  const tile = (key: ItemKey, state: 'on' | 'off' | 'locked') => {
    if (state !== 'locked' && boxed(key)) {
      return (
        <View key={key} style={[styles.tile, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
          <GiftBox
            size={64}
            wiggle
            accessibilityLabel="A gift from Bellie, tap to open"
            onOpen={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              update('giftsSeen', [...settings.giftsSeen, ITEM_UNLOCK_DAY[key]]);
            }}
          />
        </View>
      );
    }
    const art = ITEM_ART[key];
    const k = Math.min(60 / art.width, 52 / art.height);
    const remaining = daysUntil(key, days);
    const left = moreDays(remaining);
    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        accessibilityLabel={
          state === 'locked'
            ? `${ITEM_NAME[key]}, locked, ${unlockLine(remaining).toLowerCase()}`
            : ITEM_NAME[key]
        }
        accessibilityState={{ selected: state === 'on' }}
        onPress={() => (state === 'locked' ? setPeek(key) : toggle(key))}
        style={({ pressed }) => [
          styles.tile,
          {
            backgroundColor: selectedFill(colors, state === 'on'),
            ...(state === 'on' ? selectedEdge(colors, true) : cardEdge(colors)),
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        {state === 'locked' ? (
          <>
            <Lock size={28} color={colors.inkMuted} strokeWidth={2} />
            <AppText variant="caption" color="inkSoft" style={styles.left}>
              {left}
            </AppText>
          </>
        ) : (
          <SvgXml xml={art.xml} width={art.width * k} height={art.height * k} />
        )}
      </Pressable>
    );
  };

  return (
    <Screen>
      <BackHeader />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <AppText variant="display" accessibilityRole="header">
          Customize Bellie
        </AppText>
        <AppText color="inkSoft" style={styles.sub}>
          Tap things to put them on Bellie
        </AppText>

        <View style={[styles.stage, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
          <Belly size={STAGE_BELLIE} stage={stage} worn={worn} />
        </View>

        <View ref={giftRow} collapsable={false} style={styles.trayScroll}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tray}>
            {owned.map((key) => tile(key, worn.includes(key) ? 'on' : 'off'))}
            {owned.length > 0 && locked.length > 0 && (
              <View
                style={[styles.divider, { backgroundColor: colors.edge }]}
                importantForAccessibility="no"
              />
            )}
            {locked.map((key) => tile(key, 'locked'))}
          </ScrollView>
        </View>

        {/* Says how many more check-in days the next locked item needs, so there is a reason to come back. */}
        <View style={styles.unlockSlot}>
          {peeked && (
            <AppText color="inkSoft" style={styles.unlock} accessibilityLiveRegion="polite">
              {unlockLine(daysUntil(peeked, days), peeked === locked[0])}
            </AppText>
          )}
        </View>

        {/* Always takes its room, so the stage and the tray do not jump when the first item goes on. */}
        <View style={styles.offSlot}>
          {worn.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take it all off"
              onPress={() => save([])}
              hitSlop={8}
              style={({ pressed }) => [styles.off, { opacity: pressed ? 0.6 : 1 }]}>
              <AppText variant="bodyEm" color="cta">
                Take it all off
              </AppText>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.s5 },
  sub: { marginTop: space.s1 },
  stage: {
    height: 300,
    marginTop: space.s3,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: space.s2,
  },
  // The row runs to the screen's edges (the screen pads its content by 16 on each side), so the last tile is cut off.
  trayScroll: { marginTop: space.s3, marginHorizontal: -space.s3, flexGrow: 0 },
  tray: { paddingHorizontal: space.s3, gap: space.s1, alignItems: 'center' },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  left: { textAlign: 'center' },
  divider: { width: 1, height: 60, marginHorizontal: space.s1 },
  unlockSlot: { minHeight: 24, marginTop: space.s2, justifyContent: 'center' },
  unlock: { textAlign: 'center' },
  offSlot: { height: 44, marginTop: space.s3, alignItems: 'center', justifyContent: 'center' },
  off: { minHeight: 44, justifyContent: 'center' },
});
