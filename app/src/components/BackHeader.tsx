import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '@/theme';

import { TopBar } from './TopBar';

/**
 * A screen's top row: back circle, centered title, optional control at the far end. Pass `onBack`
 * when the screen has its own inner steps to walk back through before leaving.
 */
export function BackHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <TopBar title={title} onBack={onBack} right={right} />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { marginBottom: space.s2 } });
