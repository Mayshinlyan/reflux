import { StyleSheet, View } from 'react-native';

import { radius, useColors } from '@/theme';

import { AppText } from './AppText';

/** Figma "Speech bubble": a short Gaegu line in a `surface` pill, its tail pointing up at what is talking. */
export function SpeechBubble({ text }: { text: string }) {
  const colors = useColors();
  return (
    <View style={styles.wrap}>
      <View style={[styles.tail, { borderBottomColor: colors.surface }]} />
      <View style={[styles.bubble, { backgroundColor: colors.surface }]}>
        <AppText variant="voiceSmall">{text}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  // A CSS-style triangle: transparent sides and a coloured bottom edge.
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  bubble: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.pill },
});
