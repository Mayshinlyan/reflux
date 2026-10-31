import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  type CalendarMonth,
  daysOf,
  EMPTY_SELECTION,
  inSelection,
  monthGrid,
  monthsBetween,
  nextSelection,
  type Selection,
  selectionPeriod,
} from '@/lib/calendar';
import type { Period } from '@/lib/range';
import { MONTH_NAMES } from '@/lib/range';
import { fontFamily, radius, space, useColors } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';
import { TopBar } from './TopBar';

type Props = {
  visible: boolean;
  /** The first day with an entry; the calendar starts in its month. */
  firstDayKey: string;
  todayKey: string;
  /** Entries per day ("YYYY-MM-DD"), for the dots and the count on the button. */
  counts: ReadonlyMap<string, number>;
  /** A range already picked by hand, shown selected when the calendar opens. */
  initial: Period | null;
  onApply: (period: Period) => void;
  onClose: () => void;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CELL_HEIGHT = 48;

/**
 * Figma "04i Pick dates": a full-screen calendar, oldest month at the top and this month at the bottom. Tap a
 * start day and an end day; days with entries have a dot and days after today can't be chosen. "See N entries"
 * applies the range, Reset clears it and the X closes without changing anything.
 */
export function DateRangePicker(props: Props) {
  // Mounted only while open, so each opening starts fresh from `initial`.
  return (
    <Modal
      visible={props.visible}
      animationType="slide"
      onRequestClose={props.onClose}
      statusBarTranslucent
      navigationBarTranslucent>
      <PickerBody {...props} />
    </Modal>
  );
}

function PickerBody({ firstDayKey, todayKey, counts, initial, onApply, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selection, setSelection] = useState<Selection>(
    initial ? { start: initial.startKey, end: initial.endKey } : EMPTY_SELECTION,
  );
  const scroll = useRef<ScrollViewInstance>(null);
  const scrolled = useRef(false);
  const months = monthsBetween(firstDayKey < todayKey ? firstDayKey : todayKey, todayKey);

  const period = selectionPeriod(selection);
  const total = period ? daysOf(period).reduce((sum, day) => sum + (counts.get(day) ?? 0), 0) : 0;
  const applyLabel = period ? `See ${total} ${total === 1 ? 'entry' : 'entries'}` : 'See entries';

  return (
    // Not `Screen`: inside a Modal its safe-area view reports no insets, which put the top bar under the camera.
    <View
      style={[
        styles.page,
        {
          backgroundColor: colors.bg,
          paddingTop: insets.top + space.s2,
          paddingBottom: Math.max(insets.bottom, space.s2),
        },
      ]}>
      <TopBar close title="Select dates" onBack={onClose} />
      <View style={styles.weekdays}>
        {WEEKDAYS.map((letter, index) => (
          <AppText
            key={index}
            variant="label"
            color="inkSoft"
            style={styles.weekday}
            importantForAccessibility="no">
            {letter}
          </AppText>
        ))}
      </View>
      <ScrollView
        ref={scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.months}
        // Open on the latest month, where the recent entries are.
        onContentSizeChange={() => {
          if (scrolled.current) return;
          scrolled.current = true;
          scroll.current?.scrollToEnd({ animated: false });
        }}>
        {months.map((month) => (
          <Month
            key={month.key}
            month={month}
            todayKey={todayKey}
            counts={counts}
            selection={selection}
            onPick={(dayKey) => setSelection((current) => nextSelection(current, dayKey))}
          />
        ))}
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: colors.bg }]}>
        <View style={styles.reset}>
          <Button label="Reset" variant="secondary" onPress={() => setSelection(EMPTY_SELECTION)} />
        </View>
        {/* No width: like Figma, the button is only as wide as its text, pushed to the right. */}
        <View>
          <Button label={applyLabel} disabled={!period} onPress={() => period && onApply(period)} />
        </View>
      </View>
    </View>
  );
}

function Month({
  month,
  todayKey,
  counts,
  selection,
  onPick,
}: {
  month: CalendarMonth;
  todayKey: string;
  counts: ReadonlyMap<string, number>;
  selection: Selection;
  onPick: (dayKey: string) => void;
}) {
  return (
    <View>
      <AppText variant="section" accessibilityRole="header" style={styles.monthTitle}>
        {month.title}
      </AppText>
      {monthGrid(month).map((week, index) => (
        <View key={index} style={styles.week}>
          {week.map((dayKey, column) =>
            dayKey === null ? (
              <View key={column} style={styles.cell} />
            ) : (
              <Day
                key={dayKey}
                dayKey={dayKey}
                disabled={dayKey > todayKey}
                entries={counts.get(dayKey) ?? 0}
                selection={selection}
                onPick={onPick}
              />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function Day({
  dayKey,
  disabled,
  entries,
  selection,
  onPick,
}: {
  dayKey: string;
  disabled: boolean;
  entries: number;
  selection: Selection;
  onPick: (dayKey: string) => void;
}) {
  const colors = useColors();
  const period = selectionPeriod(selection);
  const isStart = period?.startKey === dayKey;
  const isEnd = period?.endKey === dayKey;
  const endpoint = isStart || isEnd;
  const inside = inSelection(selection, dayKey);
  const single = period !== null && period.startKey === period.endKey;
  const date = Number(dayKey.slice(8, 10));
  const spoken = `${MONTH_NAMES[Number(dayKey.slice(5, 7)) - 1]} ${date}${
    entries > 0 ? `, ${entries} ${entries === 1 ? 'entry' : 'entries'}` : ''
  }`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityState={{ disabled, selected: inside }}
      disabled={disabled}
      onPress={() => onPick(dayKey)}
      style={[styles.cell, disabled && styles.future]}>
      {inside && !single && (
        <View
          style={[
            styles.band,
            { backgroundColor: colors.surface2 },
            // The ends only shade towards the middle of the range.
            isStart && { left: '50%' },
            isEnd && { right: '50%' },
          ]}
        />
      )}
      {endpoint && <View style={[styles.circle, { backgroundColor: colors.cta }]} />}
      <AppText
        style={[styles.date, endpoint && { color: colors.ctaInk, fontFamily: fontFamily.bold }]}
        color="ink">
        {date}
      </AppText>
      {entries > 0 && !endpoint && <View style={[styles.dot, { backgroundColor: colors.sageInk }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: space.s3 },
  weekdays: { flexDirection: 'row', marginTop: space.s4 },
  weekday: { flex: 1, textAlign: 'center' },
  months: { paddingBottom: space.s2 },
  // Room above each title: under the weekday row and between months, so a month never runs into the next one.
  monthTitle: { paddingTop: 40, paddingBottom: space.s1_5 },
  week: { flexDirection: 'row' },
  cell: { flex: 1, height: CELL_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  future: { opacity: 0.35 },
  band: { position: 'absolute', top: 4, bottom: 4, left: 0, right: 0 },
  circle: { position: 'absolute', width: 40, height: 40, borderRadius: radius.pill },
  date: { lineHeight: 24 },
  dot: { position: 'absolute', bottom: 7, width: 5, height: 5, borderRadius: 3 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s1_5, paddingTop: space.s2 },
  reset: { width: 112 },
});
