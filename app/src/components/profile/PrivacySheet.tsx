import { StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { PrivacyPoints } from '@/components/PrivacyPoints';
import { space } from '@/theme';

/** Where your data lives, and that this isn't medical advice (Figma 05a). */
export function PrivacySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        Privacy and disclaimer
      </AppText>
      <PrivacyPoints />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({ title: { marginBottom: space.s2 } });
