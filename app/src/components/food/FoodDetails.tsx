import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
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
  /** "Also save to My foods", ticked on the verdict before the meal is logged. */
  keep: boolean;
};

type Props = {
  mealName: string;
  /** Absent for a meal logged without a verdict. */
  verdict?: AppVerdict;
  whenLabel: string;
  onPickTime: () => void;
  state: MealDetailsState;
  onChange: (next: MealDetailsState) => void;
  maxNote: number;
};

const toggled = <T,>(set: Set<T>, value: T) => {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
};

/**
 * Figma "03d Food: details": shown after the meal is already logged, so everything here is extra. The
 * headline says so; the sections are plain nouns.
 */
export function FoodDetails({ mealName, verdict, whenLabel, onPickTime, state, onChange, maxNote }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.meal}>
        <AppText variant="display" accessibilityRole="header">
          {'Logged!\nAnything to add?'}
        </AppText>
        <AppText variant="title">{mealName}</AppText>
        <View style={styles.timeRow}>
          <TimePill label={whenLabel} onPress={onPickTime} />
          {verdict && <VerdictBadge verdict={verdict} />}
        </View>
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
        <AppText variant="section">Lifestyle</AppText>
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
        <AppText variant="section">Symptoms</AppText>
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
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s4 },
  meal: { gap: 16 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 },
});
