import { BEDTIME_OPTIONS, formatClock } from '@/lib/clock';

import { OptionSheet } from './OptionSheet';

const CHOICES = BEDTIME_OPTIONS.map((option) => ({ value: option, label: formatClock(option) }));

type Props = {
  visible: boolean;
  /** Current bedtime, "HH:MM". */
  value: string;
  onChoose: (bedtime: string) => void;
  onClose: () => void;
  /** Line under the title, e.g. how late meals are flagged. */
  note?: string;
  saveFailed?: boolean;
};

/** Bedtimes from 8:00 PM to 2:00 AM in half-hour steps, in a bottom sheet (Settings and onboarding). */
export function BedtimeSheet({ visible, value, onChoose, onClose, note, saveFailed }: Props) {
  return (
    <OptionSheet
      visible={visible}
      title="Bedtime"
      note={note}
      options={CHOICES}
      value={value}
      onChoose={onChoose}
      onClose={onClose}
      saveFailed={saveFailed}
    />
  );
}
