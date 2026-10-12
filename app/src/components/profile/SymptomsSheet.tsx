import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { SymptomZones } from '@/components/SymptomZones';
import { SYMPTOM_KEYS, type SymptomKey } from '@/constants/symptomItems';
import { useSettings } from '@/db/DatabaseProvider';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { space } from '@/theme';

/**
 * Pick the symptoms you usually feel (Figma 06c). They are shown first when you log.
 * Give it a new `key` each time it opens so it starts from the saved list.
 */
export function SymptomsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { settings, update } = useSettings();
  const [selected, setSelected] = useState<ReadonlySet<SymptomKey>>(new Set(settings.usualSymptoms));
  const [saveFailed, setSaveFailed] = useState(false);

  const toggle = (key: SymptomKey) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  const save = () => {
    try {
      // In catalog order, so the saved list doesn't depend on tap order.
      update(
        'usualSymptoms',
        SYMPTOM_KEYS.filter((key) => selected.has(key)),
      );
    } catch (error) {
      logger.error('saveUsualSymptoms', error);
      setSaveFailed(true);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        Usual symptoms
      </AppText>
      <SymptomZones selected={selected} onToggle={toggle} />
      <View style={styles.footer}>
        {saveFailed && (
          <AppText color="redInk" style={styles.error}>
            {friendlyMessages.INTERNAL}
          </AppText>
        )}
        <Button label="Save" onPress={save} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space.s2 },
  footer: { marginTop: space.s3 },
  error: { marginBottom: space.s1 },
});
