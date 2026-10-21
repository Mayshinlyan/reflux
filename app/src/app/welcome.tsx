import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { Button } from '@/components/Button';
import { Confetti } from '@/components/Confetti';
import { AllowStep } from '@/components/onboarding/AllowStep';
import { BedtimeStep } from '@/components/onboarding/BedtimeStep';
import { ConditionStep } from '@/components/onboarding/ConditionStep';
import { HowItWorksStep } from '@/components/onboarding/HowItWorksStep';
import { InsightStep } from '@/components/onboarding/InsightStep';
import { MedicationsStep } from '@/components/onboarding/MedicationsStep';
import { PrivacyStep } from '@/components/onboarding/PrivacyStep';
import { RecapStep } from '@/components/onboarding/RecapStep';
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

/** Every screen, in order (Figma 01a to 01j). */
const FLOW = [
  'welcome',
  'bellie',
  'how',
  'insight',
  'condition',
  'symptoms',
  'bedtime',
  'medications',
  'privacy',
  'reminders',
  'allow',
  'recap',
  'ready',
] as const;
type Step = (typeof FLOW)[number];

/** How far the progress bar is on each screen; Welcome and Ready have no bar, and the permission screen shares its step with the timing question. */
const BAR_STEP: Partial<Record<Step, number>> = {
  bellie: 1,
  how: 2,
  insight: 3,
  condition: 4,
  symptoms: 5,
  bedtime: 6,
  medications: 7,
  privacy: 8,
  reminders: 9,
  allow: 9,
  recap: 10,
};
const BAR_TOTAL = 10;

/** First launch: say hello, meet Bellie, show how it works, ask the setup questions, then finish (Figma 01a to 01j). */
export default function WelcomeScreen() {
  const { update } = useSettings();
  const [index, setIndex] = useState(0);
  // Kept here so coming back to a question shows what they chose.
  const [conditions, setConditions] = useState<ConditionKey[]>([]);
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(DEFAULT_REMINDER_MINUTES);
  const step = FLOW[index];
  const barStep = BAR_STEP[step];
  const goTo = (to: Step) => setIndex(FLOW.indexOf(to));
  const next = () => setIndex(index + 1);
  // Never back onto the permission screen: it would ask again, get the stored answer and bounce straight forward.
  const back = () => goTo(step === 'recap' ? 'reminders' : FLOW[index - 1]);

  const finish = (firstMeal: boolean) => {
    // Fire and forget: onboarding never waits on the network, and getIdToken() retries lazily.
    ensureAnonymousSession().catch((error) => logger.error('anonymousSignIn', error));
    try {
      update('onboardingDone', true);
    } catch (error) {
      // Still let them in; Welcome will simply show again next launch.
      logger.error('completeOnboarding', error);
    }
    router.replace('/');
    if (firstMeal) router.push('/log/food');
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

      {step === 'welcome' && (
        <Centered>
          <View style={styles.mark}>
            <Belly size={112} />
          </View>
          <AppText variant="hero" accessibilityRole="header" style={styles.title}>
            Let&apos;s see how your belly feels.
          </AppText>
          <AppText variant="voice" color="inkSoft">
            Log meals, notice patterns, and keep it gentle, one cozy day at a time.
          </AppText>
        </Centered>
      )}

      {step === 'bellie' && <BellieSays text="Hi there! I'm Bellie!" />}
      {step === 'ready' && <BellieSays text="Ready when you are!" confetti />}

      {step === 'how' && <HowItWorksStep onNext={next} />}
      {step === 'insight' && <InsightStep onNext={next} />}
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
      {step === 'bedtime' && <BedtimeStep onNext={next} />}
      {step === 'medications' && <MedicationsStep onNext={next} />}
      {step === 'privacy' && <PrivacyStep onNext={next} />}
      {step === 'reminders' && (
        <RemindersStep
          initial={reminderMinutes}
          onNext={(minutes) => {
            setReminderMinutes(minutes);
            goTo(minutes === null ? 'recap' : 'allow');
          }}
        />
      )}
      {step === 'allow' && reminderMinutes !== null && <AllowStep minutes={reminderMinutes} onDone={next} />}
      {step === 'recap' && <RecapStep onNext={next} />}

      {(step === 'welcome' || step === 'bellie') && (
        <View style={styles.bottom}>
          <Button label={step === 'welcome' ? 'Get started' : 'Continue'} onPress={next} />
        </View>
      )}
      {step === 'ready' && (
        <View style={styles.bottom}>
          <Button label="Log my first meal" onPress={() => finish(true)} />
          <Button label="Look around" variant="secondary" onPress={() => finish(false)} />
        </View>
      )}
    </Screen>
  );
}

/** Bellie centred on the screen with a bubble above it (Figma 01b, 01j). */
function BellieSays({ text, confetti = false }: { text: string; confetti?: boolean }) {
  return (
    <Centered>
      <View style={styles.group}>
        {confetti && <Confetti />}
        <SpeechBubble large tail="down" text={text} />
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
  // Visible so the confetti can scatter above the bubble instead of being cut off at the top.
  fill: { flex: 1, overflow: 'visible' },
  centered: { flexGrow: 1, justifyContent: 'center' },
  mark: { marginBottom: space.s3, marginLeft: -space.s1 },
  title: { marginBottom: space.s2 },
  // The confetti is anchored to the top of this group (the bubble), so it scatters around the bubble.
  group: { alignItems: 'center' },
  bellie: { marginTop: space.s1 },
  bottom: { paddingTop: space.s2, paddingBottom: space.s3, gap: space.s1 },
});
