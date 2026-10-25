import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { TagChip } from '@/components/TagChip';
import { TextField } from '@/components/TextField';
import { findCommonMedication } from '@/constants/commonMedications';
import { space } from '@/theme';

export const MAX_DOSE = 40;
export const MAX_DOSE_NOTE = 500;

/** Whether a stored dose is one the chips can't show (so "Other" starts chosen with the text in the field). */
export const isOtherDose = (name: string, dose: string) => {
  const common = findCommonMedication(name);
  return !!common && dose !== '' && !common.doses.includes(dose);
};

type Props = {
  name: string;
  dose: string;
  /** "Other" is chosen, so the dose is typed rather than picked. */
  custom: boolean;
  note: string;
  onDose: (dose: string) => void;
  onCustom: (custom: boolean) => void;
  onNote: (note: string) => void;
};

/**
 * Figma "03h Medication: details" and "15b Edit dose": the Dose chips (or a field for a medication with no
 * common doses, or "Other") and the Note. Shared by logging a dose and by editing one.
 */
export function DoseFields({ name, dose, custom, note, onDose, onCustom, onNote }: Props) {
  const common = findCommonMedication(name);
  return (
    <>
      <View style={styles.section}>
        <AppText variant="section">Dose</AppText>
        {common && (
          <View accessibilityRole="radiogroup" style={styles.types}>
            {common.doses.map((option) => (
              <TagChip
                key={option}
                role="radio"
                label={option}
                selected={!custom && dose === option}
                onPress={() => {
                  // Tapping the chosen dose again clears it.
                  onDose(dose === option && !custom ? '' : option);
                  onCustom(false);
                }}
              />
            ))}
            <TagChip
              role="radio"
              label="Other"
              selected={custom}
              onPress={() => {
                onCustom(true);
                onDose('');
              }}
            />
          </View>
        )}
        {(!common || custom) && (
          <TextField
            label="Dose"
            hideLabel
            value={dose}
            onChangeText={onDose}
            placeholder="e.g. 20mg"
            maxLength={MAX_DOSE}
          />
        )}
      </View>
      <View style={styles.section}>
        <AppText variant="section">Note</AppText>
        <TextField
          label="Note"
          hideLabel
          value={note}
          onChangeText={onNote}
          placeholder="e.g. Taken with breakfast"
          maxLength={MAX_DOSE_NOTE}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.s1_5 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1, marginBottom: space.s2 },
});
