import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { minTouchTarget } from '@/theme';

/** The way out of any voice screen (Figma 45b to 45g): leave and type it instead. */
export function TypeInstead({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Type instead"
      onPress={onPress}
      style={styles.link}>
      <AppText variant="bodyEm" color="inkSoft">
        Type instead
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: minTouchTarget, alignItems: 'center', justifyContent: 'center' },
});
