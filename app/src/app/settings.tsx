import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { SettingsRow } from '@/components/SettingsRow';
import { SwipeNav } from '@/components/SwipeNav';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { deleteAllData } from '@/db/repositories/data';
import { BEDTIME_OPTIONS, formatClock } from '@/lib/clock';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { deleteAllPhotos } from '@/services/photoStore';
import { minTouchTarget, space, useColors } from '@/theme';

const MAX_PET_NAME = 24;

// Module-level so the swipe gesture isn't rebuilt on every render.
const closeProfile = () => router.back();

type Sheet = 'bedtime' | 'pet' | null;

/** Settings ("Profile" in the mockup). */
export default function SettingsScreen() {
  const colors = useColors();
  const toast = useToast();
  const db = useDb();
  const { settings, update, reload } = useSettings();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [petName, setPetName] = useState(settings.petName);
  const [saveFailed, setSaveFailed] = useState(false);

  const closeSheet = () => {
    setSheet(null);
    setSaveFailed(false);
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

  const trimmedName = petName.trim();
  const savePetName = () => {
    try {
      update('petName', trimmedName);
    } catch (error) {
      logger.error('savePetName', error);
      setSaveFailed(true);
      return;
    }
    closeSheet();
    toast('Name saved');
  };

  const confirmDeleteAll = () => {
    Alert.alert(
      'Delete all your data?',
      "This permanently removes every symptom, meal, medication and photo from this phone, and resets your pet. It can't be undone.",
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
      {/* Profile slides in from the left, so swiping left closes it. */}
      <SwipeNav onSwipeLeft={closeProfile} enabled={sheet === null}>
        <ScrollView contentContainerStyle={styles.content}>
          <BackHeader title="Profile" />
          <SectionTitle first>Activity</SectionTitle>
          <SettingsRow label="Your Logs" onPress={() => router.push('/history')} />

          <SectionTitle>Personalize</SectionTitle>
          <SettingsRow
            label="Bedtime"
            value={formatClock(settings.bedtime)}
            onPress={() => setSheet('bedtime')}
          />
          <SettingsRow
            label="My pet"
            value={settings.petName}
            onPress={() => {
              setPetName(settings.petName);
              setSheet('pet');
            }}
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
            are not kept by Reflux.
          </AppText>
          <Button label="Delete all my data" variant="quietDanger" onPress={confirmDeleteAll} />
        </ScrollView>
      </SwipeNav>

      <BottomSheet visible={sheet === 'bedtime'} onClose={closeSheet}>
        <AppText variant="title" accessibilityRole="header">
          Bedtime
        </AppText>
        <AppText color="inkSoft" style={styles.sheetSub}>
          Meals within 3 hours of bedtime are flagged as late.
        </AppText>
        <View accessibilityRole="radiogroup">
          {BEDTIME_OPTIONS.map((option) => {
            const selected = option === settings.bedtime;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityLabel={formatClock(option)}
                accessibilityState={{ checked: selected }}
                onPress={() => chooseBedtime(option)}
                style={[styles.option, { borderBottomColor: colors.hairline }]}>
                <AppText
                  style={[
                    styles.optionText,
                    selected && { color: colors.clayInk, fontFamily: 'Nunito_800ExtraBold' },
                  ]}>
                  {formatClock(option)}
                </AppText>
                {selected && <Check size={18} color={colors.clayInk} strokeWidth={2.6} />}
              </Pressable>
            );
          })}
        </View>
        {saveFailed && (
          <AppText color="redInk" style={styles.error}>
            {friendlyMessages.INTERNAL}
          </AppText>
        )}
      </BottomSheet>

      <BottomSheet visible={sheet === 'pet'} onClose={closeSheet}>
        <AppText variant="title" accessibilityRole="header">
          My pet
        </AppText>
        <AppText color="inkSoft" style={styles.sheetSub}>
          What would you like to call your companion?
        </AppText>
        <TextField
          label="Name"
          value={petName}
          onChangeText={setPetName}
          maxLength={MAX_PET_NAME}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => {
            if (trimmedName.length > 0) savePetName();
          }}
        />
        {saveFailed && (
          <AppText color="redInk" style={styles.error}>
            {friendlyMessages.INTERNAL}
          </AppText>
        )}
        <Button label="Save" onPress={savePetName} disabled={trimmedName.length === 0} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.s4 },
  note: { marginTop: space.s2 },
  sheetSub: { marginTop: 4, marginBottom: space.s2, fontSize: 15, lineHeight: 21 },
  option: {
    minHeight: Math.max(minTouchTarget, 52),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  optionText: { fontSize: 16 },
  error: { marginBottom: space.s1 },
});
