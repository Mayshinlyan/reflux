import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { tabBarClearance } from '@/components/FloatingTabBar';
import { Screen } from '@/components/Screen';
import { radius, space, useColors } from '@/theme';

/**
 * Kitchen: recipe ideas that go easy on your belly (Figma row 29). This first step only adds the tab, so it holds
 * a short note; the "Cook something" card, the fridge and saved recipes (29a) come next.
 */
export default function KitchenScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance(insets.bottom) }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <AppText variant="display" accessibilityRole="header">
            Kitchen
          </AppText>
          <AppText variant="voiceSmall" color="inkSoft">
            What shall we cook?
          </AppText>
        </View>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Belly mood="happy" size={72} />
          <View style={styles.cardText}>
            <AppText variant="displaySmall">Coming soon</AppText>
            <AppText variant="subtitle" color="inkSoft">
              Bellie is learning to cook. Recipe ideas that go easy on your belly will show up here.
            </AppText>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.s2, gap: space.s3 },
  heading: { gap: space.s1, marginBottom: space.s1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    padding: space.s3 - 4,
    borderRadius: radius.lg,
  },
  cardText: { flex: 1, gap: 4 },
});
