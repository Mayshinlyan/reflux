import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CheckboxRow } from '@/components/CheckboxRow';
import { PortionSelect } from '@/components/PortionSelect';
import { SymptomChip } from '@/components/SymptomChip';
import { TagChip } from '@/components/TagChip';
import { TextField } from '@/components/TextField';
import { TimePill } from '@/components/TimePill';
import { VerdictBadge } from '@/components/VerdictBadge';
import { LIFESTYLE_TAGS, type LifestyleTagKey } from '@/constants/lifestyleTags';
import { SYMPTOM_ITEMS, type SymptomKey } from '@/constants/symptomItems';
import { space } from '@/theme';
import type { AppVerdict, Portion } from '@/types/analysis';

/** The few symptoms offered right after a meal; the full list lives on the Symptoms screen. */
export const MEAL_SYMPTOM_KEYS: SymptomKey[] = ['heartburn', 'burping', 'hoarseness', 'stomach_pain'];
const MEAL_SYMPTOMS = MEAL_SYMPTOM_KEYS.map(
  (key) => SYMPTOM_ITEMS.find((item) => item.key === key) ?? { key, label: key },
);

export type MealDetailsState = {
  portion: Portion;
  tags: Set<LifestyleTagKey>;
  symptoms: Set<SymptomKey>;
  note: string;
  keep: boolean;
};

type Props = {
  mealName: string;
  /** Absent for a meal saved without a verdict. */
  verdict?: AppVerdict;
  whenLabel: string;
  onPickTime: () => void;
  state: MealDetailsState;
  onChange: (next: MealDetailsState) => void;
  /** "Also save to My foods"; hidden where that is already its own button. */
  showKeep: boolean;
  maxNote: number;
};

const toggled = <T,>(set: Set<T>, value: T) => {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
};

/** Figma "03d Food: details": time, portion, lifestyle tags, symptoms and a note, after the verdict. */
export function FoodDetails({
  mealName,
  verdict,
  whenLabel,
  onPickTime,
  state,
  onChange,
  showKeep,
  maxNote,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.meal}>
        {verdict && <VerdictBadge verdict={verdict} />}
        <AppText variant="hero" accessibilityRole="header">
          {mealName}
        </AppText>
        <TimePill label={whenLabel} onPress={onPickTime} />
      </View>
      <View style={styles.section}>
        <AppText variant="section">Portion</AppText>
        <PortionSelect
          hideLabel
          value={state.portion}
          onChange={(portion) => onChange({ ...state, portion })}
        />
      </View>
      <View style={styles.section}>
        <AppText variant="section">Anything else?</AppText>
        <View style={styles.chips}>
          {LIFESTYLE_TAGS.map((tag) => (
            <TagChip
              key={tag.key}
              label={tag.label}
              selected={state.tags.has(tag.key)}
              onPress={() => onChange({ ...state, tags: toggled(state.tags, tag.key) })}
            />
          ))}
        </View>
      </View>
      <View style={styles.section}>
        <AppText variant="section">Any symptoms? (optional)</AppText>
        <View style={styles.chips}>
          {MEAL_SYMPTOMS.map((symptom) => (
            <SymptomChip
              key={symptom.key}
              label={symptom.label}
              selected={state.symptoms.has(symptom.key)}
              onToggle={() => onChange({ ...state, symptoms: toggled(state.symptoms, symptom.key) })}
            />
          ))}
        </View>
      </View>
      <View style={styles.section}>
        <AppText variant="section">Note</AppText>
        <TextField
          label="Note"
          hideLabel
          value={state.note}
          onChangeText={(note) => onChange({ ...state, note })}
          placeholder="How did it feel?"
          maxLength={maxNote}
          returnKeyType="done"
        />
      </View>
      {showKeep && (
        <CheckboxRow
          label="Also save to My foods"
          checked={state.keep}
          onToggle={() => onChange({ ...state, keep: !state.keep })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s4 },
  meal: { gap: 16, alignItems: 'flex-start' },
  section: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 },
});
