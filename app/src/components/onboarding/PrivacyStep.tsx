import { Button } from '@/components/Button';
import { PrivacyPoints } from '@/components/PrivacyPoints';

import { StepLayout } from './StepLayout';

/** What happens to their data, and that this isn't medical advice (Figma 01g). */
export function PrivacyStep({ onNext }: { onNext: () => void }) {
  return (
    <StepLayout title="Your data stays with you." footer={<Button label="Continue" onPress={onNext} />}>
      <PrivacyPoints />
    </StepLayout>
  );
}
