import { Activity, Bell, Moon } from 'lucide-react-native';

import { Button } from '@/components/Button';
import { PointList } from '@/components/PointList';
import { useSettings } from '@/db/DatabaseProvider';
import { formatClock, formatWindow } from '@/lib/clock';
import { watchingLine } from '@/lib/onboardingRecap';

import { StepLayout } from './StepLayout';

/** Bellie says it back before the finish: what it will watch for, bedtime and check-ins (Figma 01i). Read from what they chose. */
export function RecapStep({ onNext }: { onNext: () => void }) {
  const { settings } = useSettings();
  const minutes = settings.checkInReminderMinutes;
  return (
    <StepLayout title="Here's your plan." footer={<Button label="Looks good" onPress={onNext} />}>
      <PointList
        points={[
          { icon: Activity, title: 'Watching for', body: watchingLine(settings.usualSymptoms) },
          { icon: Moon, title: 'Bedtime', body: formatClock(settings.bedtime) },
          {
            icon: Bell,
            title: 'Check-ins',
            body:
              minutes === null
                ? 'Off for now. You can turn them on in Settings.'
                : `${formatWindow(minutes)} after meals`,
          },
        ]}
      />
    </StepLayout>
  );
}
