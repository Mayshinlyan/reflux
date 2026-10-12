import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Clock, Moon, Pill, Shield, Trash2, Utensils } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { BackHeader } from '@/components/BackHeader';
import { BedtimeSheet } from '@/components/BedtimeSheet';
import { OptionSheet } from '@/components/OptionSheet';
import { PrivacySheet } from '@/components/profile/PrivacySheet';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { SettingsRow } from '@/components/SettingsRow';
import { useToast } from '@/components/Toast';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { deleteAllData } from '@/db/repositories/data';
import { formatClock, formatWindow, LATE_MEAL_WINDOW_OPTIONS } from '@/lib/clock';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { deleteAllPhotos } from '@/services/photoStore';
import { space } from '@/theme';

type Sheet = 'bedtime' | 'window' | 'privacy' | null;

const WINDOWS = LATE_MEAL_WINDOW_OPTIONS.map((minutes) => ({
  value: String(minutes),
  label: formatWindow(minutes),
}));

/** Settings, opened from the gear on You (Figma 05). */
export default function SettingsScreen() {
  const toast = useToast();
  const db = useDb();
  const { settings, update, reload } = useSettings();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  const closeSheet = () => {
    setSheet(null);
    setSaveFailed(false);
  };

  const persist = (write: () => void, what: string) => {
    try {
      write();
    } catch (error) {
      logger.error(what, error);
      setSaveFailed(true);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    closeSheet();
  };

  const confirmDeleteAll = () => {
    Alert.alert(
      'Delete all your data?',
      "This permanently removes every symptom, meal, medication and photo from this phone. It can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            try {
              deleteAllData(db);
            } catch (error) {
              logger.error('deleteAllData', error);
              Alert.alert("Couldn't delete", friendlyMessages.INTERNAL);
              return;
            }
            try {
              deleteAllPhotos();
            } catch (error) {
              // Rows are already gone; a leftover file is the lesser problem, so still report success.
              logger.error('deleteAllPhotos', error);
            }
            reload();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            toast('All your data was deleted');
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <BackHeader title="Settings" />
      <ScrollView showsVerticalScrollIndicator={false}>
        <SectionTitle first>Preferences</SectionTitle>
        <SettingsRow
          icon={Moon}
          label="Bedtime"
          value={formatClock(settings.bedtime)}
          onPress={() => setSheet('bedtime')}
        />
        <SettingsRow
          icon={Clock}
          label="Late-meal window"
          value={formatWindow(settings.lateMealWindowMinutes)}
          onPress={() => setSheet('window')}
        />

        <SectionTitle>Your lists</SectionTitle>
        <SettingsRow
          icon={Utensils}
          label="My foods"
          onPress={() => router.push({ pathname: '/log/food', params: { manage: '1' } })}
        />
        <SettingsRow
          icon={Pill}
          label="My medications"
          onPress={() => router.push({ pathname: '/log/medication', params: { manage: '1' } })}
        />

        <SectionTitle>About</SectionTitle>
        <SettingsRow icon={Shield} label="Privacy and disclaimer" onPress={() => setSheet('privacy')} />

        <View style={styles.danger}>
          <SettingsRow icon={Trash2} label="Delete all my data" danger onPress={confirmDeleteAll} />
        </View>
      </ScrollView>

      <BedtimeSheet
        visible={sheet === 'bedtime'}
        value={settings.bedtime}
        onChoose={(bedtime) => persist(() => update('bedtime', bedtime), 'saveBedtime')}
        onClose={closeSheet}
        note={`Meals within ${formatWindow(settings.lateMealWindowMinutes)} of bedtime are flagged as late.`}
        saveFailed={saveFailed}
      />
      <OptionSheet
        visible={sheet === 'window'}
        title="Late-meal window"
        note="Meals logged this close to bedtime get a late-meal tag."
        options={WINDOWS}
        value={String(settings.lateMealWindowMinutes)}
        onChoose={(minutes) =>
          persist(() => update('lateMealWindowMinutes', Number(minutes)), 'saveLateWindow')
        }
        onClose={closeSheet}
        saveFailed={saveFailed}
      />
      <PrivacySheet visible={sheet === 'privacy'} onClose={closeSheet} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  danger: { marginTop: space.s2 },
});
