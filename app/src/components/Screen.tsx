import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { space, useColors } from '@/theme';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  /** Tab screens drop 'bottom' because the tab bar already pads for the gesture bar. */
  edges?: Edge[];
};

const ALL_EDGES: Edge[] = ['top', 'bottom', 'left', 'right'];

/** Every screen is wrapped in safe-area insets so nothing sits under the notch or gesture bar. */
export function Screen({ children, style, edges = ALL_EDGES }: Props) {
  const colors = useColors();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={edges}>
      <View style={[styles.pad, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  pad: { flex: 1, paddingHorizontal: space.s3, paddingTop: space.s2, paddingBottom: space.s2 },
});
