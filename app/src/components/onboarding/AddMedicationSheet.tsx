import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TagChip } from '@/components/TagChip';
import { TextField } from '@/components/TextField';
import { COMMON_MEDICATIONS, type CommonMedication } from '@/constants/commonMedications';
import { MEDICATION_TYPES, type MedicationType } from '@/constants/medicationTypes';
import type { MedicationInput } from '@/db/repositories/medications';
import { space } from '@/theme';

const MAX_NAME = 60;
const MAX_DOSE = 40;

type Mode = { kind: 'pick' } | { kind: 'dose'; med: CommonMedication } | { kind: 'custom' };

type Props = {
  visible: boolean;
  onClose: () => void;
  /** They finished adding one; the sheet closes itself afterwards. */
  onAdd: (input: MedicationInput) => void;
};

const typeLabel = (type: MedicationType) => MEDICATION_TYPES.find((t) => t.key === type)?.label ?? type;

/**
 * Adds a medication the way "Medications" does (Figma 01f.1 to 01f.3): pick a common one (then an optional dose), or
 * "Not listed? Enter your own" with a name, a type and an optional dose.
 */
export function AddMedicationSheet({ visible, onClose, onAdd }: Props) {
  const [mode, setMode] = useState<Mode>({ kind: 'pick' });
  const [dose, setDose] = useState('');
  const [otherDose, setOtherDose] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<MedicationType | null>(null);

  const reset = () => {
    setMode({ kind: 'pick' });
    setDose('');
    setOtherDose(false);
    setName('');
    setType(null);
  };

  const finish = (input: MedicationInput) => {
    onAdd(input);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} onDismissed={reset} tone="bg">
      {mode.kind === 'pick' && (
        <>
          <AppText variant="displaySmall" accessibilityRole="header">
            Add a medication
          </AppText>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.list}
            contentContainerStyle={styles.groups}>
            {MEDICATION_TYPES.filter((group) => COMMON_MEDICATIONS.some((med) => med.type === group.key)).map(
              (group) => (
                <View key={group.key} style={styles.group}>
                  <AppText variant="sectionSm">{group.label}</AppText>
                  <View style={styles.chips}>
                    {COMMON_MEDICATIONS.filter((med) => med.type === group.key).map((med) => (
                      <TagChip
                        key={med.name}
                        role="button"
                        label={med.name}
                        selected={false}
                        onPress={() => {
                          setDose('');
                          setOtherDose(false);
                          setMode({ kind: 'dose', med });
                        }}
                      />
                    ))}
                  </View>
                </View>
              ),
            )}
          </ScrollView>
          <Button
            label="Not listed? Enter your own"
            variant="secondary"
            onPress={() => setMode({ kind: 'custom' })}
          />
        </>
      )}

      {mode.kind === 'dose' && (
        <>
          <AppText variant="displaySmall" accessibilityRole="header">
            {mode.med.name}
          </AppText>
          <AppText variant="small" color="inkSoft" style={styles.typeNote}>
            {`Type: ${typeLabel(mode.med.type)}`}
          </AppText>
          <View style={styles.group}>
            <AppText variant="sectionSm">Dose (optional)</AppText>
            <View accessibilityRole="radiogroup" style={styles.chips}>
              {mode.med.doses.map((option) => (
                <TagChip
                  key={option}
                  role="radio"
                  label={option}
                  selected={!otherDose && dose === option}
                  onPress={() => {
                    // Tapping the chosen dose again clears it.
                    setDose(dose === option && !otherDose ? '' : option);
                    setOtherDose(false);
                  }}
                />
              ))}
              <TagChip
                role="radio"
                label="Other dose"
                selected={otherDose}
                onPress={() => {
                  setOtherDose(true);
                  setDose('');
                }}
              />
            </View>
          </View>
          {otherDose && (
            <TextField
              label="Dose"
              value={dose}
              onChangeText={setDose}
              placeholder="e.g. 20mg"
              maxLength={MAX_DOSE}
            />
          )}
          <View style={styles.actions}>
            <Button
              label="Add medication"
              onPress={() =>
                finish({ name: mode.med.name, type: mode.med.type, defaultDose: dose.trim() || null })
              }
            />
            <Button label="Back" variant="quiet" onPress={() => setMode({ kind: 'pick' })} />
          </View>
        </>
      )}

      {mode.kind === 'custom' && (
        <>
          <AppText variant="displaySmall" accessibilityRole="header">
            Add your own
          </AppText>
          <View style={styles.form}>
            <TextField
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Zegerid"
              maxLength={MAX_NAME}
              autoCapitalize="words"
            />
            <View style={styles.group}>
              <AppText variant="sectionSm">Type</AppText>
              <View accessibilityRole="radiogroup" style={styles.chips}>
                {MEDICATION_TYPES.map((option) => (
                  <TagChip
                    key={option.key}
                    role="radio"
                    label={option.label}
                    selected={type === option.key}
                    onPress={() => setType(option.key)}
                  />
                ))}
              </View>
            </View>
            <TextField
              label="Dose"
              hint="(optional)"
              value={dose}
              onChangeText={setDose}
              placeholder="e.g. 20mg"
              maxLength={MAX_DOSE}
            />
          </View>
          <View style={styles.actions}>
            <Button
              label="Add medication"
              disabled={name.trim().length === 0}
              onPress={() => finish({ name, type: type ?? 'other', defaultDose: dose.trim() || null })}
            />
            <Button label="Back" variant="quiet" onPress={() => setMode({ kind: 'pick' })} />
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 340, marginTop: space.s2, marginBottom: space.s2 },
  groups: { gap: space.s3 },
  group: { gap: space.s1 + 4, marginTop: space.s1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 },
  typeNote: { marginTop: 4 },
  form: { marginTop: space.s2, gap: space.s2 },
  actions: { marginTop: space.s3, gap: space.s1 },
});
