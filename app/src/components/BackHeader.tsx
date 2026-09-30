import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { minTouchTarget, space, useColors } from '@/theme';

import { AppText } from './AppText';

/**
 * The mockup's back row: chevron + screen title. Pass `onBack` when the screen has its own
 * inner steps to walk back through before leaving; `right` puts a small control at the far end.
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
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        style={styles.back}>
        <ChevronLeft size={26} color={colors.ink} strokeWidth={2.2} />
      </Pressable>
      <AppText variant="title" accessibilityRole="header" numberOfLines={1} style={styles.title}>
        {title}
      </AppText>
      {right && <View style={styles.right}>{right}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s1, marginBottom: space.s2 },
  back: { width: minTouchTarget, height: minTouchTarget, justifyContent: 'center', marginLeft: -space.s1 },
  title: { flexShrink: 1 },
  right: { marginLeft: 'auto' },
});
