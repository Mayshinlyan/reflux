import { Pill } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AddRow } from '@/components/AddRow';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { MEDICATION_TYPES, type MedicationType } from '@/constants/medicationTypes';
import { useDb } from '@/db/DatabaseProvider';
import {
  archiveMedication,
  createMedication,
  listMedications,
  type MedicationInput,
} from '@/db/repositories/medications';
import { logger } from '@/lib/logger';
import { radius, space, useColors } from '@/theme';

import { AddMedicationSheet } from './AddMedicationSheet';
import { StepLayout } from './StepLayout';

const typeLabel = (type: MedicationType) => MEDICATION_TYPES.find((t) => t.key === type)?.label ?? type;

/**
 * The medications they take regularly (Figma 01f to 01f.4): an "Add a medication" row opens the same picker as "My
 * medications". Each add or remove is saved at once (a remove archives, so history stays), so going back and forth never
 * leaves duplicates. With none added the button is "Skip for now"; with some it is "Continue".
 */
export function MedicationsStep({ onNext }: { onNext: () => void }) {
  const colors = useColors();
  const db = useDb();
  const [meds, setMeds] = useState(() => listMedications(db));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const save = (action: () => void) => {
    try {
      action();
      setMeds(listMedications(db));
      setSaveFailed(false);
    } catch (error) {
      logger.error('saveOnboardingMedications', error);
      setSaveFailed(true);
    }
  };

  const add = (input: MedicationInput) => save(() => void createMedication(db, input));

  return (
    <StepLayout
      title="Do you take any medication?"
      subtitle="Add the ones you take regularly, so logging a dose is one tap."
      saveFailed={saveFailed}
      footer={
        meds.length === 0 ? (
          <Button label="Skip for now" variant="secondary" onPress={onNext} />
        ) : (
          <Button label="Continue" onPress={onNext} />
        )
      }>
      <View style={styles.list}>
        {meds.map((med) => {
          const title = med.defaultDose ? `${med.name} ${med.defaultDose}` : med.name;
          return (
            <View key={med.id} style={[styles.row, { backgroundColor: colors.surface }]}>
              <View style={[styles.icon, { backgroundColor: colors.clayTint }]}>
                <Pill size={18} color={colors.clayInk} strokeWidth={2} />
              </View>
              <View style={styles.text}>
                <AppText variant="bodyEm">{title}</AppText>
                <AppText variant="caption" color="inkSoft">
                  {typeLabel(med.type)}
                </AppText>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${title}`}
                hitSlop={4}
                onPress={() => save(() => archiveMedication(db, med.id))}
                style={[styles.pill, { backgroundColor: colors.sageTint }]}>
                <AppText variant="label" style={{ color: colors.sageInk }}>
                  Remove
                </AppText>
              </Pressable>
            </View>
          );
        })}
        <AddRow
          label={meds.length === 0 ? 'Add a medication' : 'Add another'}
          onPress={() => setSheetOpen(true)}
        />
      </View>
      <AppText variant="caption" color="inkSoft" style={styles.note}>
        You can edit this list anytime in Settings.
      </AppText>
      <AddMedicationSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} onAdd={add} />
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg },
  icon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  pill: {
    minHeight: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  note: { marginTop: space.s2 },
});
