import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { space, useColors } from '@/theme';

type Props = { children: ReactNode; style?: ViewStyle };

/** Every screen is wrapped in safe-area insets so nothing sits under the notch or gesture bar. */
export function Screen({ children, style }: Props) {
  const colors = useColors();
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.pad, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { flex: 1, paddingHorizontal: space.s3, paddingTop: space.s2, paddingBottom: space.s2 },
});
