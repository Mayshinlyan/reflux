import { Heart, Star } from 'lucide-react-native';
import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { InlineAddChip } from '@/components/InlineAddChip';
import { NameField } from '@/components/NameField';
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
import { minTouchTarget, space, typography, useColors } from '@/theme';
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
  /** "Add to favorite foods", ticked here after the meal is logged. */
  keep: boolean;
};

type Props = {
  mealName: string;
  /**
   * Edit entry (Figma 15a): the same page for a meal already in History. The heading shows its verdict and the
   * name as a field instead of the "Added to today" line and the skip line.
   */
  edit?: { verdict: AppVerdict | null; onRename: (name: string) => void; maxName: number };
  /** Offer "Add to favorite foods": false when the meal is already one of them. */
  canFavorite: boolean;
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
 * Figma "03d.3 Food: check-in (saved, skippable)": shown after the meal is already logged, so it says so and
 * everything else is optional. It follows How I feel: a saved confirmation, the food as the big title, a short
 * line under it, then tap-only chips (each group starting with a "+" to add your own), the one-line note, and
 * "Add to favorite foods".
 */
export function FoodDetails({
  mealName,
  edit,
  canFavorite,
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
  const colors = useColors();
  const sectionY = useRef<Record<string, number>>({});
  const reveal = (key: string) => onReveal(sectionY.current[key] ?? 0);

  return (
    <View style={styles.wrap}>
      {edit ? (
        <View style={styles.heading}>
          {edit.verdict && <VerdictBadge verdict={edit.verdict} />}
          <NameField
            label="Meal name"
            value={mealName}
            onChangeText={edit.onRename}
            maxLength={edit.maxName}
            placeholder="Name this meal"
          />
        </View>
      ) : (
        <View style={styles.heading}>
          <View style={styles.titleRow}>
            <AppText variant="display" accessibilityRole="header" style={styles.title}>
              {mealName}
            </AppText>
            {canFavorite && (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel="Add to favorite foods"
                accessibilityState={{ checked: state.keep }}
                onPress={() => onChange({ ...state, keep: !state.keep })}
                hitSlop={8}
                style={styles.heart}>
                <Heart
                  size={24}
                  color={colors.clayInk}
                  fill={state.keep ? colors.clayInk : 'none'}
                  strokeWidth={2}
                />
              </Pressable>
            )}
          </View>
          <AppText variant="voice" color="inkSoft">
            How&apos;s your belly?
          </AppText>
        </View>
      )}
      <View style={styles.timeRow}>
        <TimePill label={whenLabel} onPress={onPickTime} />
      </View>
      <View
        style={styles.section}
        onLayout={(event) => {
          sectionY.current.tags = event.nativeEvent.layout.y;
        }}>
        <AppText variant="section">What&apos;s going on?</AppText>
        <View style={styles.chips}>
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
          <InlineAddChip
            label="Add your own to What's going on?"
            placeholder="e.g. Skipped breakfast"
            onAdd={onAddTag}
            onOpen={() => reveal('tags')}
          />
        </View>
      </View>
      <View
        style={styles.section}
        onLayout={(event) => {
          sectionY.current.symptoms = event.nativeEvent.layout.y;
        }}>
        <AppText variant="section">Anything bothering you now?</AppText>
        <View style={styles.chips}>
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
          <InlineAddChip
            label="Add your own symptom"
            placeholder="e.g. Hiccups"
            onAdd={onAddSymptom}
            onOpen={() => reveal('symptoms')}
          />
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
      {edit && canFavorite && (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="Add to favorite foods"
          accessibilityState={{ checked: state.keep }}
          onPress={() => onChange({ ...state, keep: !state.keep })}
          style={styles.favorite}>
          <Star
            size={24}
            color={colors.clayInk}
            fill={state.keep ? colors.clayInk : 'none'}
            strokeWidth={2}
          />
          <View style={styles.favoriteText}>
            <AppText variant="bodyEm" style={styles.favoriteLabel}>
              Add to favorite foods
            </AppText>
            <AppText variant="caption" color="inkSoft">
              Log it in one tap next time.
            </AppText>
          </View>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.s4 },
  heading: { gap: space.s1_5, alignItems: 'flex-start' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.s1, alignSelf: 'stretch' },
  title: { flex: 1 },
  heart: { width: minTouchTarget, height: minTouchTarget, alignItems: 'center', justifyContent: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  favorite: { flexDirection: 'row', alignItems: 'center', gap: space.s1_5, minHeight: minTouchTarget },
  favoriteText: { gap: 2 },
  favoriteLabel: { ...typography.small, fontFamily: typography.bodyEm.fontFamily },
  section: { gap: space.s1_5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 },
});
