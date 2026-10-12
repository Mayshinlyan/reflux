import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { BedtimeSheet } from '@/components/BedtimeSheet';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TAB_BAR_CLEARANCE } from '@/components/FloatingTabBar';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { SettingsRow } from '@/components/SettingsRow';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { deleteAllData } from '@/db/repositories/data';
import { USER_NAME_MAX } from '@/db/repositories/settings';
import { formatClock, formatWindow } from '@/lib/clock';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { deleteAllPhotos } from '@/services/photoStore';
import { space } from '@/theme';

type Sheet = 'name' | 'bedtime' | null;

/** Settings ("Profile" in the mockup). */
export default function SettingsScreen() {
  const toast = useToast();
  const db = useDb();
  const { settings, update, reload } = useSettings();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const closeSheet = () => {
    setSheet(null);
    setSaveFailed(false);
  };

  const openName = () => {
    setNameDraft(settings.userName);
    setSheet('name');
  };

  const saveName = () => {
    try {
      update('userName', nameDraft);
    } catch (error) {
      logger.error('saveName', error);
      setSaveFailed(true);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    closeSheet();
  };

  const chooseBedtime = (bedtime: string) => {
    try {
      update('bedtime', bedtime);
    } catch (error) {
      logger.error('saveBedtime', error);
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
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <AppText variant="display" accessibilityRole="header" style={styles.title}>
          You
        </AppText>
        <SectionTitle first>Personalize</SectionTitle>
        <SettingsRow label="Your name" value={settings.userName || 'Add'} onPress={openName} />
        <SettingsRow
          label="Bedtime"
          value={formatClock(settings.bedtime)}
          onPress={() => setSheet('bedtime')}
        />
        <SettingsRow
          label="My foods"
          onPress={() => router.push({ pathname: '/log/food', params: { manage: '1' } })}
        />
        <SettingsRow
          label="My medications"
          onPress={() => router.push({ pathname: '/log/medication', params: { manage: '1' } })}
        />

        <SectionTitle>Your data</SectionTitle>
        <AppText variant="caption" color="inkSoft" style={styles.note}>
          Everything you log stays on this phone. Food descriptions and photos are sent to be analyzed, and
          are not kept by a day in my belly.
        </AppText>
        <Button label="Delete all my data" variant="quietDanger" onPress={confirmDeleteAll} />
      </ScrollView>

      <BottomSheet visible={sheet === 'name'} onClose={closeSheet}>
        <TextField
          label="Your name"
          value={nameDraft}
          onChangeText={setNameDraft}
          placeholder="Your name"
          maxLength={USER_NAME_MAX}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={saveName}
        />
        {saveFailed && (
          <AppText color="redInk" style={styles.error}>
            {friendlyMessages.INTERNAL}
          </AppText>
        )}
        <Button label="Save" onPress={saveName} />
      </BottomSheet>

      <BedtimeSheet
        visible={sheet === 'bedtime'}
        value={settings.bedtime}
        onChoose={chooseBedtime}
        onClose={closeSheet}
        note={`Meals within ${formatWindow(settings.lateMealWindowMinutes)} of bedtime are flagged as late.`}
        saveFailed={saveFailed}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: TAB_BAR_CLEARANCE },
  title: { marginBottom: space.s4 },
  note: { marginBottom: space.s2 },
  error: { marginBottom: space.s1 },
});
