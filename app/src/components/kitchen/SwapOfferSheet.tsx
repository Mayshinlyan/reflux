import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { CheckboxRow } from '@/components/CheckboxRow';
import { slotLabel } from '@/constants/mealPlan';
import type { SwapOffer } from '@/lib/planToday';
import { cardEdge, radius, space, useColors } from '@/theme';

type Props = {
  offer: SwapOffer | null;
  /** The food that "Note ... as a possible trigger" would record. */
  trigger: string;
  /** Swap the next meal; `note` is whether the food was ticked as a possible trigger. */
  onSwap: (note: boolean) => void;
  onNotNow: () => void;
};

/**
 * "Felt off after dinner?" (Figma "meal planning flow" I): offered only after a planned meal was logged and a symptom
 * followed within a few hours. Swapping asks the plan for a different meal; it never changes anything by itself.
 */
export function SwapOfferSheet({ offer, trigger, onSwap, onNotNow }: Props) {
  const colors = useColors();
  // Unticked: noting a food writes to their avoid list, so it is their choice, not ours.
  const [note, setNote] = useState(false);
  const slot = offer ? slotLabel(offer.meal.slot).toLowerCase() : 'meal';
  const nextSlot = offer ? slotLabel(offer.next.slot).toLowerCase() : 'meal';
  return (
    <BottomSheet visible={offer !== null} onClose={onNotNow} tone="bg">
      <View style={styles.center}>
        <Belly size={72} />
        <AppText variant="displaySmall" accessibilityRole="header" style={styles.text}>
          Felt off after {slot}?
        </AppText>
        <AppText color="inkSoft" style={styles.text}>
          You logged {offer?.symptom} {offer?.after} after your {slot}. Want a different {nextSlot} for the
          rest of the week?
        </AppText>
      </View>
      <View style={[styles.note, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
        <CheckboxRow
          label={`Note ${trigger} as a possible trigger`}
          checked={note}
          onToggle={() => setNote((on) => !on)}
        />
      </View>
      <View style={styles.actions}>
        <Button label={`Swap the next ${nextSlot}`} onPress={() => onSwap(note)} />
        <Button label="Not now" variant="secondary" onPress={onNotNow} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space.s1_5, paddingTop: space.s1 },
  text: { textAlign: 'center' },
  note: { marginTop: space.s2, borderRadius: radius.md, paddingHorizontal: space.s2 },
  actions: { marginTop: space.s2, gap: space.s1_5 },
});
