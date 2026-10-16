import { router } from 'expo-router';
import { User } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { radius, useColors } from '@/theme';

/** The plain person circle at the top right of Today and History; it opens Profile. */
export function ProfileButton() {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Profile"
      hitSlop={6}
      onPress={() => router.push('/profile')}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
      ]}>
      <User size={20} color={colors.ink} strokeWidth={2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 36 to look, with hitSlop making it a 48 target (Figma 02a).
  button: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
