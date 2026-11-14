import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { ITEM_GIFT_TITLE, type ItemKey } from '@/lib/bellieItems';
import type { Gift } from '@/lib/completionFlow';
import { cardEdge, radius, space, useColors } from '@/theme';

import { CompletionLayout } from './CompletionLayout';
import { Confetti } from './Confetti';
import { GiftBox } from './GiftBox';
import { HoppingBelly } from './HoppingBelly';

type Props = {
  gift: Gift;
  /** "Put it on" (an item): saved and closed. */
  onWear: (item: ItemKey) => void;
  /** "See my report". */
  onReport: () => void;
  /** "Later", or finishing. */
  onDone: () => void;
};

/** Screen 4 (Figma G4): a wrapped gift that wiggles; tapping it shows what is inside. An item on its day, or the first report. */
export function GiftPage({ gift, onWear, onReport, onDone }: Props) {
  const [opened, setOpened] = useState(false);
  if (!opened) return <ClosedGift gift={gift} onOpen={() => setOpened(true)} />;
  return gift.kind === 'item' ? (
    <CompletionLayout
      backdrop={<Confetti />}
      action={{ label: 'Put it on', onPress: () => onWear(gift.item) }}
      quiet={{ label: 'Later', onPress: onDone }}>
      <HoppingBelly forceItem={gift.item} shadow size={240} />
      <AppText variant="display" accessibilityRole="header" style={styles.title}>
        {ITEM_GIFT_TITLE[gift.item]}
      </AppText>
      <AppText color="inkSoft" style={styles.line}>
        Find it any time in Customize Bellie.
      </AppText>
    </CompletionLayout>
  ) : (
    <ReportGift onReport={onReport} onDone={onDone} />
  );
}

function ClosedGift({ gift, onOpen }: { gift: Gift; onOpen: () => void }) {
  return (
    <CompletionLayout backdrop={<Confetti count={8} />} action={{ label: 'Open it', onPress: onOpen }}>
      <GiftBox wiggle onOpen={onOpen} />
      <AppText variant="display" accessibilityRole="header" style={styles.title}>
        Bellie left you a gift
      </AppText>
      <AppText color="inkSoft" style={styles.line}>
        {gift.kind === 'item' ? `For ${gift.day} days of check-ins` : 'For a week of check-ins'}
      </AppText>
    </CompletionLayout>
  );
}

function ReportGift({ onReport, onDone }: { onReport: () => void; onDone: () => void }) {
  const colors = useColors();
  const reduceMotion = useReducedMotion();
  return (
    <CompletionLayout
      backdrop={<Confetti />}
      action={{ label: 'See my report', onPress: onReport }}
      quiet={{ label: 'Later', onPress: onDone }}>
      <Animated.View
        entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)}
        style={[styles.preview, { backgroundColor: colors.surface, ...cardEdge(colors) }]}
        importantForAccessibility="no-hide-descendants">
        <AppText variant="displaySmall">Your week with Bellie</AppText>
        {[130, 110, 90].map((width) => (
          <View key={width} style={styles.previewRow}>
            <View style={[styles.avatar, { backgroundColor: colors.sageTint }]} />
            <View style={{ gap: 6 }}>
              <View style={[styles.line1, { width, backgroundColor: colors.surface2 }]} />
              <View style={[styles.line1, { width: 70, height: 6, backgroundColor: colors.surface2 }]} />
            </View>
          </View>
        ))}
        <View style={[styles.newTag, { backgroundColor: colors.cta }]}>
          <AppText variant="label" color="ctaInk">
            New
          </AppText>
        </View>
      </Animated.View>
      <AppText variant="display" accessibilityRole="header" style={styles.title}>
        Your first pattern is ready
      </AppText>
      <AppText color="inkSoft" style={styles.line}>
        A week of check-ins did it.
      </AppText>
    </CompletionLayout>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: space.s3, textAlign: 'center' },
  line: { marginTop: space.s1, textAlign: 'center' },
  preview: { width: 248, borderRadius: radius.lg, padding: space.s3, gap: space.s1_5 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: space.s1_5 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  line1: { height: 8, borderRadius: 4 },
  newTag: {
    position: 'absolute',
    top: -14,
    left: 19,
    borderRadius: radius.pill,
    paddingHorizontal: space.s3,
    paddingVertical: 6,
  },
});
