import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { InlineAddChip } from '@/components/InlineAddChip';
import { SymptomChip } from '@/components/SymptomChip';
import { TagChip } from '@/components/TagChip';
import { TextField } from '@/components/TextField';
import { TimePill } from '@/components/TimePill';
import { VerdictBadge } from '@/components/VerdictBadge';
import { type CustomTagKey, LIFESTYLE_TAGS, type LoggedTagKey } from '@/constants/lifestyleTags';
import {
  type CustomSymptomKey,
  customSymptomLabel,
  type LoggedSymptomKey,
  SYMPTOM_ITEMS,
  type SymptomKey,
} from '@/constants/symptomItems';
import { space } from '@/theme';
import type { AppVerdict } from '@/types/analysis';

/** The few symptoms offered right after a meal; the full list lives on the How I feel screen. */
export const MEAL_SYMPTOM_KEYS: SymptomKey[] = ['heartburn', 'burping', 'hoarseness', 'stomach_pain'];
const MEAL_SYMPTOMS = MEAL_SYMPTOM_KEYS.map(
  (key) => SYMPTOM_ITEMS.find((item) => item.key === key) ?? { key, label: key },
);

export type MealDetailsState = {
  tags: Set<LoggedTagKey>;
  symptoms: Set<LoggedSymptomKey>;
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
  /** What the user typed with a "+" chip before, offered after the built-in chips. */
  ownTags: CustomTagKey[];
  ownSymptoms: CustomSymptomKey[];
  /** Called with what was typed in a "+" chip; the screen saves it and picks it. */
  onAddTag: (text: string) => void;
  onAddSymptom: (text: string) => void;
  /** Called with a section's top when its "+" field opens, so the screen can scroll it above the keyboard. */
  onReveal: (y: number) => void;
};

const toggled = <T,>(set: Set<T>, value: T) => {
  const next = new Set(set);
  if (!next.delete(value)) next.add(value);
  return next;
};

/**
 * Figma "03d.1 Food: check-in": shown after the meal is already logged, so everything here is optional. It
 * follows How I feel: the food as the big title, a short line under it, then tap-only chips (each group
 * starting with a "+" to add your own) before the one-line note.
 */
export function FoodDetails({
  mealName,
  verdict,
  whenLabel,
  onPickTime,
  state,
  onChange,
  maxNote,
  ownTags,
  ownSymptoms,
  onAddTag,
  onAddSymptom,
  onReveal,
}: Props) {
  const sectionY = useRef<Record<string, number>>({});
  const reveal = (key: string) => onReveal(sectionY.current[key] ?? 0);

  return (
    <View style={styles.wrap}>
      <AppText variant="display" accessibilityRole="header">
        {mealName}
      </AppText>
      <AppText color="inkSoft" style={styles.subtitle}>
        Anything else? All optional.
      </AppText>
      <View style={styles.timeRow}>
        <TimePill label={whenLabel} onPress={onPickTime} />
        {verdict && <VerdictBadge verdict={verdict} />}
      </View>
      <View
        style={styles.section}
        onLayout={(event) => {
          sectionY.current.tags = event.nativeEvent.layout.y;
        }}>
        <AppText variant="section">What&apos;s going on?</AppText>
        <View style={styles.chips}>
          <InlineAddChip
            label="Add your own to What's going on?"
            placeholder="e.g. Skipped breakfast"
            onAdd={onAddTag}
            onOpen={() => reveal('tags')}
          />
          {LIFESTYLE_TAGS.map((tag) => (
            <TagChip
              key={tag.key}
              label={tag.label}
              selected={state.tags.has(tag.key)}
              onPress={() => onChange({ ...state, tags: toggled(state.tags, tag.key) })}
            />
          ))}
          {ownTags.map((key) => (
            <TagChip
              key={key}
              label={customSymptomLabel(key)}
              selected={state.tags.has(key)}
              onPress={() => onChange({ ...state, tags: toggled(state.tags, key) })}
            />
          ))}
        </View>
      </View>
      <View
        style={styles.section}
        onLayout={(event) => {
          sectionY.current.symptoms = event.nativeEvent.layout.y;
        }}>
        <AppText variant="section">Anything bothering you now?</AppText>
        <View style={styles.chips}>
          <InlineAddChip
            label="Add your own symptom"
            placeholder="e.g. Hiccups"
            onAdd={onAddSymptom}
            onOpen={() => reveal('symptoms')}
          />
          {MEAL_SYMPTOMS.map((symptom) => (
            <SymptomChip
              key={symptom.key}
              label={symptom.label}
              selected={state.symptoms.has(symptom.key)}
              onToggle={() => onChange({ ...state, symptoms: toggled(state.symptoms, symptom.key) })}
            />
          ))}
          {ownSymptoms.map((key) => (
            <SymptomChip
              key={key}
              label={customSymptomLabel(key)}
              selected={state.symptoms.has(key)}
              onToggle={() => onChange({ ...state, symptoms: toggled(state.symptoms, key) })}
            />
          ))}
        </View>
      </View>
      <TextField
        label="Note"
        hideLabel
        value={state.note}
        onChangeText={(note) => onChange({ ...state, note })}
        placeholder="Add a note (optional)"
        maxLength={maxNote}
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s4 },
  subtitle: { fontSize: 15, lineHeight: 21, marginTop: -space.s2, marginBottom: space.s1 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 },
});
