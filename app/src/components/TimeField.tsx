import DateTimePicker from '@react-native-community/datetimepicker';
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { earliestMealTime, formatMealTime } from '@/lib/mealTime';
import { minTouchTarget, radius, space, typography, useColors } from '@/theme';

import { AppText } from './AppText';
import { pickTimeAndroid } from './MealTimeSheet';

/**
 * When something happened, for editing a past entry. Closed, it is one row with the day and time, like the
 * dropdowns. Tapped, the wheel opens in place on iPhone (not a second sheet, since it lives in one) and the
 * system dialogs open on Android. Never later than now; the earliest day is the past week, or the entry's own
 * day when it is older.
 */
export function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (at: Date) => void;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const now = new Date();
  // From the entry's own time, so the limit doesn't move as the wheel turns.
  const [original] = useState(value);
  const earliest = earliestMealTime(now);
  const minimum = original < earliest ? original : earliest;

  const toggle = () => {
    if (Platform.OS === 'android') pickTimeAndroid(value, onChange, minimum);
    else setOpen((wasOpen) => !wasOpen);
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="label" color="inkSoft" style={styles.label}>
        {label}
      </AppText>
      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.hairline }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${formatMealTime(value, now)}`}
          accessibilityState={{ expanded: open }}
          onPress={toggle}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.85 : 1 }]}>
          <AppText style={[styles.value, { color: colors.ink }]}>{formatMealTime(value, now)}</AppText>
          <ChevronDown size={20} color={colors.inkSoft} strokeWidth={2} />
        </Pressable>
        {open && (
          <View style={[styles.wheel, { borderTopColor: colors.hairline }]}>
            <DateTimePicker
              value={value}
              mode="datetime"
              display="spinner"
              minuteInterval={5}
              minimumDate={minimum}
              maximumDate={now}
              textColor={colors.ink}
              themeVariant="light"
              onValueChange={(_, at) => onChange(at.getTime() > Date.now() ? new Date() : at)}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.s2 },
  label: { marginBottom: space.s1 },
  box: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  // Matches the dropdowns and text fields (52 high, 14 in).
  row: {
    minHeight: Math.max(minTouchTarget, 52),
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: typography.button,
  wheel: { alignItems: 'center', borderTopWidth: 1 },
});
