import { Clock } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  type MealClock,
  clockFromDate,
  composeMealTime,
  dayChoiceLabel,
  formatMealTime,
  MEAL_DAY_CHOICES,
  MINUTE_STEP,
} from '@/lib/mealTime';
import { minTouchTarget, radius, space, typography, useColors } from '@/theme';

import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { TagChip } from './TagChip';

type Props = {
  /** When the meal was eaten; null means "now", worked out when it is saved. */
  value: Date | null;
  onChange: (value: Date | null) => void;
  /** Disables the row while something else is in flight. */
  disabled?: boolean;
};

const DAYS = Array.from({ length: MEAL_DAY_CHOICES }, (_, offset) => offset);
const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 / MINUTE_STEP }, (_, index) => index * MINUTE_STEP);

const pad = (minute: number) => String(minute).padStart(2, '0');

/**
 * "When did you eat this?" for logging a meal after the fact. Shows "Now" until changed; the sheet picks a
 * day (today back to six days ago) and a time, and won't accept one that hasn't happened yet.
 */
export function MealTimePicker({ value, onChange, disabled = false }: Props) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MealClock>(() => clockFromDate(new Date(), new Date()));

  const openSheet = () => {
    const now = new Date();
    setDraft(clockFromDate(value ?? now, now));
    setOpen(true);
  };

  // `now` is read on each render so a sheet left open can't approve a time that was still in the future.
  const now = new Date();
  const picked = composeMealTime(now, draft);
  const inFuture = picked.getTime() > now.getTime();

  const apply = () => {
    if (inFuture) return;
    onChange(picked);
    setOpen(false);
  };

  const useNow = () => {
    onChange(null);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`When did you eat this? ${formatMealTime(value, now)}`}
        accessibilityHint="Opens a picker to choose when you ate it"
        disabled={disabled}
        onPress={openSheet}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: colors.surface,
            borderColor: colors.hairline,
            opacity: disabled || pressed ? 0.6 : 1,
          },
        ]}>
        <Clock size={18} color={colors.clayInk} strokeWidth={2.4} />
        <AppText variant="caption" color="inkSoft">
          Eaten
        </AppText>
        <AppText style={[styles.rowValue, { color: colors.clayInk }]}>{formatMealTime(value, now)}</AppText>
        <AppText variant="caption" color="inkSoft" style={styles.change}>
          Change
        </AppText>
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <AppText variant="title" accessibilityRole="header">
          When did you eat this?
        </AppText>

        <AppText variant="label" color="inkSoft" style={styles.group}>
          Day
        </AppText>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {DAYS.map((offset) => (
            <TagChip
              key={offset}
              role="radio"
              label={dayChoiceLabel(offset, now)}
              selected={draft.dayOffset === offset}
              onPress={() => setDraft((prev) => ({ ...prev, dayOffset: offset }))}
            />
          ))}
        </View>

        <AppText variant="label" color="inkSoft" style={styles.group}>
          Hour
        </AppText>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {HOURS.map((hour) => (
            <TagChip
              key={hour}
              role="radio"
              label={String(hour)}
              selected={draft.hour12 === hour}
              onPress={() => setDraft((prev) => ({ ...prev, hour12: hour }))}
            />
          ))}
        </View>

        <AppText variant="label" color="inkSoft" style={styles.group}>
          Minute
        </AppText>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {MINUTES.map((minute) => (
            <TagChip
              key={minute}
              role="radio"
              label={`:${pad(minute)}`}
              selected={draft.minute === minute}
              onPress={() => setDraft((prev) => ({ ...prev, minute }))}
            />
          ))}
        </View>

        <View style={[styles.chips, styles.meridiem]} accessibilityRole="radiogroup">
          <TagChip
            role="radio"
            label="AM"
            selected={!draft.pm}
            onPress={() => setDraft((prev) => ({ ...prev, pm: false }))}
          />
          <TagChip
            role="radio"
            label="PM"
            selected={draft.pm}
            onPress={() => setDraft((prev) => ({ ...prev, pm: true }))}
          />
        </View>

        {inFuture && (
          <AppText accessibilityRole="alert" color="redInk" style={styles.future}>
            That time hasn&apos;t happened yet. Pick an earlier one.
          </AppText>
        )}

        <View style={styles.actions}>
          <Button label="Set time" onPress={apply} disabled={inFuture} />
          <Button label="Use now" variant="secondary" onPress={useNow} />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingHorizontal: space.s2,
    marginBottom: space.s2,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  rowValue: { ...typography.bodyEm, fontSize: 15, fontFamily: 'Nunito_700Bold', flex: 1 },
  change: { textDecorationLine: 'underline' },
  group: { marginTop: space.s2, marginBottom: space.s1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 },
  meridiem: { marginTop: space.s1 },
  future: { marginTop: space.s2 },
  actions: { gap: space.s1, marginTop: space.s3 },
});
