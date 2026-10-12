import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { Button } from '@/components/Button';
import { Confetti } from '@/components/Confetti';
import { BedtimeStep } from '@/components/onboarding/BedtimeStep';
import { ConditionStep } from '@/components/onboarding/ConditionStep';
import { MedicationsStep } from '@/components/onboarding/MedicationsStep';
import { PrivacyStep } from '@/components/onboarding/PrivacyStep';
import { SymptomsStep } from '@/components/onboarding/SymptomsStep';
import { ProgressDots } from '@/components/ProgressDots';
import { Screen } from '@/components/Screen';
import { SpeechBubble } from '@/components/SpeechBubble';
import { TopBar } from '@/components/TopBar';
import { useSettings } from '@/db/DatabaseProvider';
import { logger } from '@/lib/logger';
import { ensureAnonymousSession } from '@/services/firebase';
import { minTouchTarget, space } from '@/theme';

/** The steps that show progress dots, in order (Figma 01a to 01g); the dots count this list. */
const STEPS = ['welcome', 'bellie', 'condition', 'symptoms', 'bedtime', 'medications', 'privacy'] as const;
/** After the last step: the closing celebration, with no dots. */
const READY = STEPS.length;

/** First launch: say hello, meet Bellie, ask the setup questions, then finish (Figma 01a to 01h). */
export default function WelcomeScreen() {
  const { update } = useSettings();
  const [index, setIndex] = useState(0);
  const step = index === READY ? 'ready' : STEPS[index];
  const next = () => setIndex(index + 1);

  const finish = () => {
    // Fire and forget: onboarding never waits on the network, and getIdToken() retries lazily.
    ensureAnonymousSession().catch((error) => logger.error('anonymousSignIn', error));
    try {
      update('onboardingDone', true);
    } catch (error) {
      // Still let them in; Welcome will simply show again next launch.
      logger.error('completeOnboarding', error);
    }
    router.replace('/');
  };

  return (
    <Screen>
      <View>
        <TopBar
          hideBack={index === 0}
          onBack={() => setIndex(index - 1)}
          right={step === 'symptoms' ? <SkipButton onPress={next} /> : undefined}
        />
        {index < READY && (
          <View pointerEvents="none" style={styles.dots}>
            <ProgressDots step={index + 1} total={STEPS.length} />
          </View>
        )}
      </View>

      {step === 'welcome' && (
        <View style={styles.body}>
          <View style={styles.mark}>
            <Belly size={112} />
          </View>
          <AppText variant="hero" accessibilityRole="header" style={styles.title}>
            Let&apos;s see how your belly feels.
          </AppText>
          <AppText variant="voice" color="inkSoft">
            Log meals, notice patterns, and keep it gentle, one cozy day at a time.
          </AppText>
        </View>
      )}

      {step === 'bellie' && <BellieSays text="Hi there! I'm Bellie!" />}
      {step === 'ready' && <BellieSays text="Ready when you are!" confetti />}

      {step === 'condition' && <ConditionStep onNext={next} />}
      {step === 'symptoms' && <SymptomsStep onNext={next} />}
      {step === 'bedtime' && <BedtimeStep onNext={next} />}
      {step === 'medications' && <MedicationsStep onNext={next} />}
      {step === 'privacy' && <PrivacyStep onNext={next} />}

      {(step === 'welcome' || step === 'bellie' || step === 'ready') && (
        <View style={styles.bottom}>
          <Button
            label={step === 'welcome' ? 'Get started' : step === 'bellie' ? 'Continue' : 'Start logging'}
            onPress={() => (step === 'ready' ? finish() : next())}
          />
        </View>
      )}
    </Screen>
  );
}

/** Text button at the far end of the top bar, for a question that can be skipped. */
function SkipButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Skip"
      onPress={onPress}
      hitSlop={8}
      style={styles.skip}>
      <AppText variant="bodyEm" color="inkSoft">
        Skip
      </AppText>
    </Pressable>
  );
}

/** Bellie centred on the screen with a bubble above it (Figma 01b, 01h). */
function BellieSays({ text, confetti = false }: { text: string; confetti?: boolean }) {
  return (
    <View style={styles.center}>
      <View style={styles.group}>
        {confetti && <Confetti />}
        <SpeechBubble large tail="down" text={text} />
        <View style={styles.bellie}>
          <Belly size={168} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Centered on the top bar, between the (hidden) back circle and the spacer.
  dots: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, justifyContent: 'center' },
  mark: { marginBottom: space.s3, marginLeft: -space.s1 },
  title: { marginBottom: space.s2 },
  center: { flex: 1, justifyContent: 'center' },
  // The confetti is anchored to the top of this group (the bubble), so it scatters around the bubble.
  group: { alignItems: 'center' },
  bellie: { marginTop: space.s1 },
  bottom: { paddingTop: space.s2, paddingBottom: space.s3 },
  skip: { height: minTouchTarget, justifyContent: 'center', paddingLeft: space.s1 },
});
