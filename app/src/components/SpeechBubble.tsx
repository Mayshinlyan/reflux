import { StyleSheet, View } from 'react-native';

import { radius, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  text: string;
  /** Where the tail points: up when the bubble sits under what is talking, down when it sits above. */
  tail?: 'up' | 'down';
  /** The roomier onboarding size, for the mascot talking on its own screen. */
  large?: boolean;
  /** The verdict's bubble: a wrapping Gaegu headline in a rounded card rather than a one-line pill. */
  card?: boolean;
  accessibilityRole?: 'header';
};

/** Figma "Speech bubble": a short Gaegu line in a `surface` pill, its tail pointing at what is talking. */
export function SpeechBubble({ text, tail = 'up', large = false, card = false, accessibilityRole }: Props) {
  const colors = useColors();
  const pointer = (
    <View
      style={[
        styles.tail,
        tail === 'up'
          ? { borderBottomWidth: 8, borderBottomColor: colors.surface }
          : { borderTopWidth: 8, borderTopColor: colors.surface },
      ]}
    />
  );
  return (
    <View style={styles.wrap}>
      {tail === 'up' && pointer}
      <View
        style={[
          styles.bubble,
          large && styles.large,
          card && styles.card,
          { backgroundColor: colors.surface },
        ]}>
        <AppText
          variant={card ? 'displaySmall' : large ? 'voice' : 'voiceSmall'}
          accessibilityRole={accessibilityRole}
          style={[large && styles.largeText, card && styles.cardText]}>
          {text}
        </AppText>
      </View>
      {tail === 'down' && pointer}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  // A CSS-style triangle: transparent sides and one coloured edge.
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  bubble: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.pill },
  large: { paddingHorizontal: 24, paddingVertical: 12 },
  largeText: { fontSize: 26, lineHeight: 30, textAlign: 'center' },
  card: { paddingHorizontal: 20, paddingVertical: 16, borderRadius: 24 },
  cardText: { textAlign: 'center' },
});
