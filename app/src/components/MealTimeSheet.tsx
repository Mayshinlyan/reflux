import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { earliestMealTime, withTimeOf } from '@/lib/mealTime';
import { space, useColors } from '@/theme';

import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

/**
 * Android has no inline wheel: the system date dialog, then the time dialog, then `onPicked`. Limited to the
 * past week; the time dialog can't be capped, so a later-today pick is pulled back to now. Cancelling either
 * dialog does nothing.
 */
export function pickTimeAndroid(start: Date, onPicked: (at: Date) => void) {
  DateTimePickerAndroid.open({
    value: start,
    mode: 'date',
    minimumDate: earliestMealTime(new Date()),
    maximumDate: new Date(),
    onValueChange: (_, day) =>
      DateTimePickerAndroid.open({
        value: withTimeOf(day, start),
        mode: 'time',
        onValueChange: (__, time) => {
          const picked = withTimeOf(day, time);
          onPicked(picked.getTime() > Date.now() ? new Date() : picked);
        },
      }),
  });
}

type Props = {
  /** Whether the sheet is open (iPhone; Android uses `pickTimeAndroid`). */
  visible: boolean;
  /** "When did you eat this?" / "When did you take this?" */
  question: string;
  confirmLabel: string;
  /** The chosen time, or null when it was left alone, meaning "now, as of this tap". */
  onConfirm: (at: Date | null) => void;
  onClose: () => void;
  /** Called once the sheet has finished closing (iPhone). */
  onDismissed?: () => void;
};

/**
 * The step after tapping Log: a date-and-time wheel that starts on now, in the past week and never later than
 * now. Leave it alone to log right now. (On Android use `pickTimeAndroid` instead of showing this.)
 */
export function MealTimeSheet({ visible, question, confirmLabel, onConfirm, onClose, onDismissed }: Props) {
  const colors = useColors();
  // Reset on each open, so an earlier choice doesn't stick to the next food.
  const [draft, setDraft] = useState<{ at: Date; touched: boolean }>({ at: new Date(), touched: false });
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft({ at: new Date(), touched: false });
  }
  const now = new Date();

  const confirm = () => {
    if (!draft.touched) return onConfirm(null);
    // The wheel is capped at the moment the sheet rendered; a sheet left open can't set a future time.
    onConfirm(draft.at.getTime() > Date.now() ? null : draft.at);
  };

  return (
    <BottomSheet visible={visible && Platform.OS !== 'android'} onClose={onClose} onDismissed={onDismissed}>
      <AppText variant="title" accessibilityRole="header">
        {question}
      </AppText>
      <View style={styles.wheel}>
        <DateTimePicker
          value={draft.at}
          mode="datetime"
          display="spinner"
          minuteInterval={5}
          minimumDate={earliestMealTime(now)}
          maximumDate={now}
          textColor={colors.ink}
          themeVariant="light"
          onValueChange={(_, at) => setDraft({ at, touched: true })}
        />
      </View>
      <View style={styles.actions}>
        <Button label={confirmLabel} onPress={confirm} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  wheel: { alignItems: 'center', marginTop: space.s1 },
  actions: { marginTop: space.s2 },
});
