import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { BottomSheet, SHEET_GUTTER } from '@/components/BottomSheet';
import { AVATARS, type AvatarKey } from '@/constants/avatars';
import { useSettings } from '@/db/DatabaseProvider';
import { logger } from '@/lib/logger';
import { space, useColors } from '@/theme';

const MAX_SIZE = 72;
const MIN_GAP = 12;
const PER_ROW = 4;

/** Pick a built-in avatar (Figma 06d). Tapping one saves it and closes; there is no Save button. */
export function AvatarSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const { settings, update } = useSettings();
  const { width } = useWindowDimensions();
  // Shrink the circles on narrow phones so the grid stays four across.
  const size = Math.min(MAX_SIZE, Math.floor((width - 2 * SHEET_GUTTER - (PER_ROW - 1) * MIN_GAP) / PER_ROW));

  const choose = (key: AvatarKey) => {
    try {
      update('avatar', key);
    } catch (error) {
      logger.error('saveAvatar', error);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText variant="section" accessibilityRole="header" style={styles.title}>
        Choose an avatar
      </AppText>
      <View style={styles.grid}>
        {AVATARS.map((item) => {
          const selected = settings.avatar === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="radio"
              accessibilityLabel={item.key === 'initial' ? 'Your initial' : `${item.label} avatar`}
              accessibilityState={{ checked: selected }}
              onPress={() => choose(item.key)}
              style={({ pressed }) => [{ width: size, height: size, opacity: pressed ? 0.85 : 1 }]}>
              <View importantForAccessibility="no-hide-descendants">
                <Avatar avatar={item.key} name={settings.userName} size="medium" diameter={size} />
              </View>
              {selected && (
                <View style={[styles.check, { backgroundColor: colors.cta }]}>
                  <Check size={16} color={colors.ctaInk} strokeWidth={2} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space.s2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.s2 },
  check: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
