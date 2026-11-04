import { Sparkles } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/AppText';
import { PRESS_SHRINK, usePressScale } from '@/hooks/usePressScale';
import { minTouchTarget, radius, space, useColors } from '@/theme';

/** "AI Ideas" with the sparkles logo and the number of ideas in a filled oval (Figma 31a). Brings back the last round. */
export function AiIdeasButton({ count, onPress }: { count: number; onPress: () => void }) {
  const colors = useColors();
  const press = usePressScale(PRESS_SHRINK);
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`AI Ideas, ${count}`}
        accessibilityHint="Shows the ideas Bellie made last time"
        onPress={onPress}
        onPressIn={press.pressIn}
        onPressOut={press.pressOut}
        style={[styles.button, { backgroundColor: colors.surface2 }]}>
        <Sparkles size={20} color={colors.ink} strokeWidth={2} />
        <AppText variant="bodyEm">AI Ideas</AppText>
        <View style={[styles.count, { backgroundColor: colors.cta }]}>
          <AppText variant="label" color="ctaInk">
            {count}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: minTouchTarget + 4,
    borderRadius: radius.pill,
    paddingHorizontal: space.s2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s1,
  },
  count: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
