import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { SettingsRow } from '@/components/SettingsRow';
import { TextField } from '@/components/TextField';
import { useToast } from '@/components/Toast';
import { useSettings } from '@/db/DatabaseProvider';
import { BEDTIME_OPTIONS, formatClock } from '@/lib/clock';
import { friendlyMessages } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { minTouchTarget, space, useColors } from '@/theme';

const MAX_PET_NAME = 24;

type Sheet = 'bedtime' | 'pet' | null;

/** Settings ("Profile" in the mockup). Privacy, feedback and delete-all arrive in Step 8. */
export default function SettingsScreen() {
  const colors = useColors();
  const toast = useToast();
  const { settings, update } = useSettings();
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

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <BackHeader title="Profile" />
        <SectionTitle first>Activity</SectionTitle>
        <SettingsRow label="History" onPress={() => router.push('/history')} />

        <SectionTitle>Reflux</SectionTitle>
        <SettingsRow
          label="My pet"
          value={settings.petName}
          onPress={() => {
            setPetName(settings.petName);
            setSheet('pet');
          }}
        />
        <SettingsRow
          label="Bedtime"
          value={formatClock(settings.bedtime)}
          onPress={() => setSheet('bedtime')}
        />
        <SettingsRow label="My medications" onPress={() => router.push('/log/medication')} />

        <AppText variant="caption" color="inkSoft" style={styles.note}>
          Privacy, feedback and deleting your data are coming next.
        </AppText>
      </ScrollView>

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
          onSubmitEditing={() => trimmedName.length > 0 && savePetName()}
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
