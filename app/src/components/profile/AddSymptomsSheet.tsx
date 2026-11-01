import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { SymptomZones } from '@/components/SymptomZones';
import { BODY_ZONES } from '@/constants/bodyZones';
import { SYMPTOM_KEYS, type SymptomKey } from '@/constants/symptomItems';
import { useSettings } from '@/db/DatabaseProvider';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { space } from '@/theme';

/**
 * Add to your usual symptoms (Figma row 25, 25e): only the symptoms that are not on the list yet, by body area.
 * They are shown first when you log. Give it a new `key` each time it opens so it starts with nothing picked.
 */
export function AddSymptomsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { settings, update } = useSettings();
  const [selected, setSelected] = useState<ReadonlySet<SymptomKey>>(new Set());
  const [saveFailed, setSaveFailed] = useState(false);
  const usual = new Set(settings.usualSymptoms);
  // Only symptoms still offered (every one belongs to a body area), so a retired key never blocks "all added".
  const allAdded = BODY_ZONES.every((zone) => zone.symptoms.every((key) => usual.has(key)));

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
        SYMPTOM_KEYS.filter((key) => usual.has(key) || selected.has(key)),
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
      <AppText variant="section" accessibilityRole="header" style={styles.title}>
        Add a symptom
      </AppText>
      {allAdded ? (
        <AppText color="inkSoft">They are all on your list.</AppText>
      ) : (
        <>
          <SymptomZones
            selected={selected}
            onToggle={toggle}
            conditions={settings.conditions}
            hidden={usual as ReadonlySet<SymptomKey>}
          />
          <View style={styles.footer}>
            {saveFailed && (
              <AppText color="redInk" style={styles.error}>
                {friendlyMessages.INTERNAL}
              </AppText>
            )}
            <Button label="Add" onPress={save} disabled={selected.size === 0} />
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: space.s2 },
  footer: { marginTop: space.s3 },
  error: { marginBottom: space.s1 },
});
