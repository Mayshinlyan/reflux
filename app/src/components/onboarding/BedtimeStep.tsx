import { Moon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { BedtimeSheet } from '@/components/BedtimeSheet';
import { Button } from '@/components/Button';
import { Select } from '@/components/Select';
import { useSettings } from '@/db/DatabaseProvider';
import { formatClock, formatWindow, LATE_MEAL_WINDOW_OPTIONS } from '@/lib/clock';
import { logger } from '@/lib/logger';
import { radius, space, typography, useColors } from '@/theme';

import { StepLayout } from './StepLayout';

const WINDOWS = LATE_MEAL_WINDOW_OPTIONS.map((minutes) => ({
  value: String(minutes),
  label: `${formatWindow(minutes)} before bed`,
}));

/** Bedtime and the late-meal window (Figma 01e). */
export function BedtimeStep({ onNext }: { onNext: () => void }) {
  const colors = useColors();
  const { settings, update } = useSettings();
  const [bedtime, setBedtime] = useState(settings.bedtime);
  const [windowMinutes, setWindowMinutes] = useState(settings.lateMealWindowMinutes);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const next = () => {
    try {
      update('bedtime', bedtime);
      update('lateMealWindowMinutes', windowMinutes);
    } catch (error) {
      logger.error('saveBedtime', error);
      setSaveFailed(true);
      return;
    }
    onNext();
  };

  return (
    <StepLayout
      title="When do you usually go to bed?"
      subtitle="Eating close to bedtime can matter. We'll flag late meals for you."
      saveFailed={saveFailed}
      footer={<Button label="Continue" onPress={next} />}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Bedtime, ${formatClock(bedtime)}`}
        accessibilityHint="Opens the bedtimes to choose from"
        onPress={() => setSheetOpen(true)}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
        ]}>
        <Moon size={24} color={colors.ink} strokeWidth={2} />
        <AppText style={styles.time}>{formatClock(bedtime)}</AppText>
        <AppText variant="caption" color="inkSoft">
          Tap to change
        </AppText>
      </Pressable>

      <AppText variant="section" accessibilityRole="header" style={styles.heading}>
        Late meal window
      </AppText>
      <Select
        label="Late meal window"
        width="100%"
        options={WINDOWS}
        value={String(windowMinutes)}
        onChange={(value) => setWindowMinutes(Number(value))}
      />
      <AppText variant="caption" color="inkSoft" style={styles.caption}>
        Meals logged inside this window get a late-meal tag.
      </AppText>

      <BedtimeSheet
        visible={sheetOpen}
        value={bedtime}
        onChoose={(choice) => {
          setBedtime(choice);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: space.s1, paddingVertical: space.s3, borderRadius: radius.lg },
  time: typography.hero,
  heading: { marginTop: space.s4, marginBottom: space.s1_5 },
  caption: { marginTop: space.s1_5 },
});
