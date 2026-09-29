import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { minTouchTarget, space, useColors } from '@/theme';

import { AppText } from './AppText';

/** The mockup's back row: chevron + screen title. */
export function BackHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={styles.back}>
        <ChevronLeft size={26} color={colors.ink} strokeWidth={2.2} />
      </Pressable>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.s1, marginBottom: space.s2 },
  back: { width: minTouchTarget, height: minTouchTarget, justifyContent: 'center', marginLeft: -space.s1 },
});
