import { Modal, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { FoodLoading } from '@/components/FoodLoading';
import { radius, space, useColors } from '@/theme';

/** While Bellie rewrites the recipe (Figma 31g): the existing steaming-pot loader on a card over a dimmed page. */
export function UpdatingModal({ visible }: { visible: boolean }) {
  const colors = useColors();
  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.scrim}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <FoodLoading source="recipes" />
          <AppText variant="caption" color="inkMuted" style={styles.center}>
            Bellie is updating your recipe. This usually takes about 10 seconds.
          </AppText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: space.s3,
    backgroundColor: 'rgba(60, 45, 30, 0.45)',
  },
  card: { borderRadius: radius.lg, padding: space.s2, gap: space.s1 },
  center: { textAlign: 'center' },
});
