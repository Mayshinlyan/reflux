import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Belly } from '@/components/Belly';
import { Button } from '@/components/Button';
import { AllowStep } from '@/components/onboarding/AllowStep';
import { BedtimeStep } from '@/components/onboarding/BedtimeStep';
import { ConditionStep } from '@/components/onboarding/ConditionStep';
import { FirstMealStep } from '@/components/onboarding/FirstMealStep';
import { HowItWorksStep } from '@/components/onboarding/HowItWorksStep';
import { PrivacyStep } from '@/components/onboarding/PrivacyStep';
import { RemindersStep } from '@/components/onboarding/RemindersStep';
import { SymptomsStep } from '@/components/onboarding/SymptomsStep';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { SpeechBubble } from '@/components/SpeechBubble';
import { TOP_BAR_BUTTON_SIZE, TopBar } from '@/components/TopBar';
import type { ConditionKey } from '@/constants/conditions';
import { useSettings } from '@/db/DatabaseProvider';
import { logger } from '@/lib/logger';
import { DEFAULT_REMINDER_MINUTES } from '@/lib/reminderTiming';
import { ensureAnonymousSession } from '@/services/firebase';
import { space } from '@/theme';

/** Every screen, in order (Figma row 17). */
const FLOW = [
  'hello',
  'how',
  'condition',
  'symptoms',
  'privacy',
  'bedtime',
  'reminders',
  'allow',
  'firstMeal',
] as const;
type Step = (typeof FLOW)[number];

/** How far the progress bar is on each screen; Hello and the first meal have no bar, and the permission screen shares its step with the timing question. */
const BAR_STEP: Partial<Record<Step, number>> = {
  how: 1,
  condition: 2,
  symptoms: 3,
  privacy: 4,
  bedtime: 5,
  reminders: 6,
  allow: 6,
};
const BAR_TOTAL = 6;

/** First launch: say hello, show how it works, ask the setup questions, then invite a first meal (Figma rows 17 and 35). */
export default function WelcomeScreen() {
  const { update } = useSettings();
  const [index, setIndex] = useState(0);
  // Kept here so coming back to a question shows what they chose.
  const [conditions, setConditions] = useState<ConditionKey[]>([]);
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(DEFAULT_REMINDER_MINUTES);
  const step = FLOW[index];
  const barStep = BAR_STEP[step];
  const next = () => setIndex(index + 1);
  // Back from the first meal lands on the timing question, not the permission screen (which would ask again).
  const back = () => setIndex(step === 'firstMeal' ? FLOW.indexOf('reminders') : index - 1);
  const toFirstMeal = () => setIndex(FLOW.indexOf('firstMeal'));

  // Setup is done once the questions are answered; the first meal that follows is an invitation, not a requirement.
  const finish = () => {
    // Fire and forget: onboarding never waits on the network, and getIdToken() retries lazily.
    ensureAnonymousSession().catch((error) => logger.error('anonymousSignIn', error));
    try {
      update('onboardingDone', true);
    } catch (error) {
      // Still let them in; Welcome will simply show again next launch.
      logger.error('completeOnboarding', error);
    }
  };

  return (
    <Screen>
      <View>
        <TopBar hideBack={index === 0} onBack={back} />
        {barStep !== undefined && (
          <View pointerEvents="none" style={styles.bar}>
            <ProgressBar step={barStep} total={BAR_TOTAL} />
          </View>
        )}
      </View>

      {step === 'hello' && <BellieSays text="Hi, I'm Bellie! Let's see how your belly feels." />}

      {step === 'how' && <HowItWorksStep onNext={next} />}
      {step === 'condition' && (
        <ConditionStep
          initial={conditions}
          onNext={(picked) => {
            setConditions(picked);
            next();
          }}
        />
      )}
      {step === 'symptoms' && <SymptomsStep onNext={next} />}
      {step === 'privacy' && <PrivacyStep onNext={next} />}
      {step === 'bedtime' && <BedtimeStep onNext={next} />}
      {step === 'reminders' && (
        <RemindersStep
          initial={reminderMinutes}
          onNext={(minutes) => {
            setReminderMinutes(minutes);
            if (minutes === null) {
              finish();
              toFirstMeal();
            } else next();
          }}
        />
      )}
      {step === 'allow' && reminderMinutes !== null && (
        <AllowStep
          minutes={reminderMinutes}
          onDone={() => {
            finish();
            toFirstMeal();
          }}
        />
      )}
      {step === 'firstMeal' && (
        <FirstMealStep
          onLog={() => {
            // Today underneath, so closing Food or logging the meal lands on it.
            router.replace('/');
            router.push('/log/food');
          }}
          onSkip={() => router.replace('/')}
        />
      )}

      {step === 'hello' && (
        <View style={styles.bottom}>
          <Button label="Get started" onPress={next} />
        </View>
      )}
    </Screen>
  );
}

/** Bellie centred on the screen with a bubble above it (Figma 17a). The bubble reads as the screen's heading. */
function BellieSays({ text }: { text: string }) {
  return (
    <Centered>
      <View style={styles.group}>
        <SpeechBubble large tail="down" text={text} accessibilityRole="header" />
        <View style={styles.bellie}>
          <Belly size={168} />
        </View>
      </View>
    </Centered>
  );
}

/** Content centred in the space above the button; it scrolls instead of overflowing on a short screen or at a large text size. */
function Centered({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.centered}
      showsVerticalScrollIndicator={false}
      bounces={false}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Runs from just after the back circle to the right edge of the top bar (Figma "Progress bar").
  bar: { ...StyleSheet.absoluteFill, left: TOP_BAR_BUTTON_SIZE + space.s2, justifyContent: 'center' },
  fill: { flex: 1 },
  centered: { flexGrow: 1, justifyContent: 'center' },
  group: { alignItems: 'center' },
  bellie: { marginTop: space.s1 },
  bottom: { paddingTop: space.s2, paddingBottom: space.s3, gap: space.s1 },
});
