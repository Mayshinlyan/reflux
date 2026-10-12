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
  close,
  right,
}: {
  /** Omit for a bare bar: just the back circle. */
  title?: string;
  onBack?: () => void;
  /** A close X instead of the back arrow. */
  close?: boolean;
  right?: ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <TopBar title={title} onBack={onBack} close={close} right={right} />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { marginBottom: space.s4 } });
