import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  Clock,
  Compass,
  Leaf,
  MessageCircle,
  Moon,
  Shield,
  Trash2,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { BedtimeSheet } from '@/components/BedtimeSheet';
import { Button } from '@/components/Button';
import { FeedbackSheet } from '@/components/FeedbackSheet';
import { OptionSheet } from '@/components/OptionSheet';
import { PrivacySheet } from '@/components/profile/PrivacySheet';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { SettingsRow } from '@/components/SettingsRow';
import { useToast } from '@/components/Toast';
import { TopBarButton } from '@/components/TopBar';
import { useTour } from '@/components/tour/TourContext';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { deleteBackupDatabases } from '@/db/client';
import { deleteAllData } from '@/db/repositories/data';
import { formatClock, formatWindow, LATE_MEAL_WINDOW_OPTIONS } from '@/lib/clock';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { formatReminder, REMINDER_OPTIONS, reminderOptionLabel } from '@/lib/reminderTiming';
import { deleteAllPhotos } from '@/services/photoStore';
import { askForReminders, cancelAllCheckIns } from '@/services/reminders';
import { space } from '@/theme';

type Sheet = 'bedtime' | 'window' | 'reminder' | 'summaries' | 'planned' | 'privacy' | 'feedback' | null;

const WINDOWS = LATE_MEAL_WINDOW_OPTIONS.map((minutes) => ({
  value: String(minutes),
  label: formatWindow(minutes),
}));

const ON = 'on';
const OFF = 'off';
const SUMMARIES = [
  { value: ON, label: 'On' },
  { value: OFF, label: 'Off' },
];
const REMINDERS = [
  { value: OFF, label: 'Off' },
  ...REMINDER_OPTIONS.map((minutes) => ({ value: String(minutes), label: reminderOptionLabel(minutes) })),
];

/** Settings, pushed from the gear at the top of Profile (Figma row 29i). It has a Back button and no bottom bar. */
export default function SettingsScreen() {
  const toast = useToast();
  const tour = useTour();
  const insets = useSafeAreaInsets();
  const db = useDb();
  const { settings, update, reload } = useSettings();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  // The phone is blocking notifications for this app, so turning the reminder on can't work from here.
  const [remindersBlocked, setRemindersBlocked] = useState(false);

  const closeSheet = () => {
    setSheet(null);
    setSaveFailed(false);
    setRemindersBlocked(false);
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

  const chooseReminder = async (choice: string) => {
    const minutes = choice === OFF ? null : Number(choice);
    if (minutes !== null && !(await askForReminders())) {
      setRemindersBlocked(true);
      return;
    }
    // Asked either way, so the one-time sheet on Today doesn't offer it again.
    persist(() => {
      update('checkInReminderMinutes', minutes);
      update('reminderAsked', true);
    }, 'saveReminder');
    if (minutes === null) {
      void cancelAllCheckIns();
      update('prepReminderPlan', null);
    }
  };

  const confirmDeleteAll = () => {
    Alert.alert(
      'Delete all your data?',
      "This permanently removes every meal, symptom, medication and photo, plus your favorite foods, your own symptoms and tags, your name and your settings from this phone. You'll set Bellie up again afterwards. It can't be undone.",
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
            // The pre-update backups are full copies of the diary, so they go too.
            deleteBackupDatabases();
            void cancelAllCheckIns();
            reload();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            toast('All your data was deleted');
            // Every setting is gone, including having finished setting up, so start again from the welcome.
            router.replace('/welcome');
          },
        },
      ],
    );
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TopBarButton
          icon={ChevronLeft}
          label="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <AppText variant="display" accessibilityRole="header" style={styles.title}>
          Settings
        </AppText>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + space.s4 }}
        showsVerticalScrollIndicator={false}>
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
        <SettingsRow
          icon={Bell}
          label="Check-in reminder"
          value={formatReminder(settings.checkInReminderMinutes)}
          onPress={() => setSheet('reminder')}
        />
        <SettingsRow
          icon={Leaf}
          label="Bellie's summaries"
          value={settings.summariesEnabled ? 'On' : 'Off'}
          onPress={() => setSheet('summaries')}
        />
        <SettingsRow
          icon={CalendarDays}
          label="Log plan meals"
          value={settings.offerPlannedMeals ? 'On' : 'Off'}
          onPress={() => setSheet('planned')}
        />

        <SectionTitle>About</SectionTitle>
        <SettingsRow
          icon={Compass}
          label="Replay app tour"
          onPress={() => {
            // Today starts it once it is on screen.
            tour.replay();
            router.navigate('/');
          }}
        />
        <SettingsRow icon={MessageCircle} label="Send feedback" onPress={() => setSheet('feedback')} />
        <SettingsRow icon={Shield} label="Privacy and disclaimer" onPress={() => setSheet('privacy')} />

        {__DEV__ && (
          <>
            {/* Development builds only: plays the completion pages as a given day, so each can be seen. */}
            <SectionTitle>Preview (development only)</SectionTitle>
            {[1, 3, 7, 30, 90, 180, 365].map((day) => (
              <SettingsRow
                key={day}
                icon={Leaf}
                label={`Completion, day ${day}`}
                onPress={() =>
                  router.push({ pathname: '/completion', params: { kind: 'meal', preview: String(day) } })
                }
              />
            ))}
            <SettingsRow
              icon={Leaf}
              label="Customize Bellie, all unlocked"
              onPress={() => router.push({ pathname: '/bellies-things', params: { preview: '60' } })}
            />
          </>
        )}

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
      <OptionSheet
        visible={sheet === 'reminder'}
        variant="cards"
        title="Check-in reminder"
        note="A gentle nudge to log how you feel after a meal."
        footnote="This reminder is set on your phone. Nothing about it is sent anywhere."
        options={REMINDERS}
        value={settings.checkInReminderMinutes === null ? OFF : String(settings.checkInReminderMinutes)}
        onChoose={chooseReminder}
        onClose={closeSheet}
        saveFailed={saveFailed}
        footer={
          remindersBlocked ? (
            <View style={styles.blocked}>
              <AppText color="redInk">
                Notifications are off for this app. Turn them on in your phone&apos;s Settings, then pick a
                time.
              </AppText>
              <Button label="Open Settings" variant="secondary" onPress={() => Linking.openSettings()} />
            </View>
          ) : undefined
        }
      />
      <OptionSheet
        visible={sheet === 'summaries'}
        variant="cards"
        title="Bellie's summaries"
        note="A short summary of your day and week on Today and History."
        footnote="To write them, your meals, symptoms and conditions are sent to an AI service. Off, Bellie only uses words made on your phone and nothing is sent."
        options={SUMMARIES}
        value={settings.summariesEnabled ? ON : OFF}
        onChoose={(choice) => persist(() => update('summariesEnabled', choice === ON), 'saveSummaries')}
        onClose={closeSheet}
        saveFailed={saveFailed}
      />
      <OptionSheet
        visible={sheet === 'planned'}
        variant="cards"
        title="Log plan meals"
        options={SUMMARIES}
        value={settings.offerPlannedMeals ? ON : OFF}
        onChoose={(choice) => persist(() => update('offerPlannedMeals', choice === ON), 'savePlannedOffer')}
        onClose={closeSheet}
        saveFailed={saveFailed}
      />
      <PrivacySheet visible={sheet === 'privacy'} onClose={closeSheet} />
      <FeedbackSheet
        visible={sheet === 'feedback'}
        onClose={closeSheet}
        onSent={() => {
          closeSheet();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          toast('Thanks, Bellie got it');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.s2, marginBottom: space.s4 },
  title: { flex: 1 },
  danger: { marginTop: space.s2 },
  blocked: { marginTop: space.s2, gap: space.s1 },
});
