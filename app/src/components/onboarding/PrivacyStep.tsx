import { Button } from '@/components/Button';
import { PrivacyPoints } from '@/components/PrivacyPoints';

import { StepLayout } from './StepLayout';

/** What happens to their data, and that this isn't medical advice (Figma 17e). */
export function PrivacyStep({ onNext }: { onNext: () => void }) {
  return (
    <StepLayout title="Your data stays anonymous." footer={<Button label="Continue" onPress={onNext} />}>
      <PrivacyPoints welcome />
    </StepLayout>
  );
}
