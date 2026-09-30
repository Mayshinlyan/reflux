import DateTimePicker from '@react-native-community/datetimepicker';
import { Clock } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { earliestMealTime, formatMealTime } from '@/lib/mealTime';
import { radius, space, typography, useColors } from '@/theme';

import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';
import { pickTimeAndroid } from './MealTimeSheet';

type Props = {
  /** When the meal was eaten; null means "now", worked out when it is saved. */
  value: Date | null;
  onChange: (value: Date | null) => void;
  /** Disables the pill while something else is in flight. */
  disabled?: boolean;
  /** The sheet's title and the pill's spoken label, e.g. "When did you take this?" for medication. */
  question?: string;
};

/**
 * "When did you eat/take this?" for logging a meal or a dose after the fact: a pill showing "Now" until changed. It opens
 * the phone's own date-and-time picker (a wheel in a sheet on iOS, the system dialogs on Android), limited to
 * the past week and never later than now.
 */
export function MealTimePicker({
  value,
  onChange,
  disabled = false,
  question = 'When did you eat this?',
}: Props) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => new Date());
  const now = new Date();

  const openSheet = () => {
    if (Platform.OS === 'android') return pickTimeAndroid(value ?? new Date(), onChange);
    setDraft(value ?? new Date());
    setOpen(true);
  };

  const apply = () => {
    // The wheel is capped at the moment the sheet rendered; a sheet left open can't set a future time.
    onChange(draft.getTime() > Date.now() ? new Date() : draft);
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
        accessibilityLabel={`${question} ${formatMealTime(value, now)}`}
        accessibilityHint="Opens a picker to choose the time"
        disabled={disabled}
        accessibilityState={{ disabled }}
        onPress={openSheet}
        hitSlop={6}
        style={({ pressed }) => [
          styles.pill,
          {
            backgroundColor: value ? colors.clayTint : colors.surface,
            borderColor: value ? colors.clay : colors.hairline,
            opacity: disabled || pressed ? 0.6 : 1,
          },
        ]}>
        <Clock size={15} color={colors.clayInk} strokeWidth={2.4} />
        <AppText style={[styles.pillText, { color: colors.clayInk }]} numberOfLines={1}>
          {formatMealTime(value, now)}
        </AppText>
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <AppText variant="title" accessibilityRole="header">
          {question}
        </AppText>
        <View style={styles.wheel}>
          <DateTimePicker
            value={draft}
            mode="datetime"
            display="spinner"
            minuteInterval={5}
            minimumDate={earliestMealTime(now)}
            maximumDate={now}
            textColor={colors.ink}
            themeVariant="light"
            onValueChange={(_, date) => setDraft(date)}
          />
        </View>
        <View style={styles.actions}>
          <Button label="Set time" onPress={apply} />
          <Button label="Use now" variant="secondary" onPress={useNow} />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 36,
    maxWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  pillText: { ...typography.label, fontSize: 14, fontFamily: 'Nunito_700Bold', flexShrink: 1 },
  wheel: { alignItems: 'center', marginTop: space.s1 },
  actions: { gap: space.s1, marginTop: space.s2 },
});
