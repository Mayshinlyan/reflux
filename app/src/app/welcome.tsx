import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { Button } from '@/components/Button';
import { Confetti } from '@/components/Confetti';
import { ProgressDots } from '@/components/ProgressDots';
import { Screen } from '@/components/Screen';
import { SpeechBubble } from '@/components/SpeechBubble';
import { TopBar } from '@/components/TopBar';
import { useSettings } from '@/db/DatabaseProvider';
import { logger } from '@/lib/logger';
import { ensureAnonymousSession } from '@/services/firebase';
import { space } from '@/theme';

/**
 * The steps that show progress dots, in order. The setup questions from the Figma flow (condition,
 * usual symptoms, bedtime, medications, privacy) slot in after 'bellie'; the dots count this list.
 */
const STEPS = ['welcome', 'bellie'] as const;
/** After the last step: the closing celebration, with no dots. */
const READY = STEPS.length;

/** First launch: say hello, meet Bellie, then finish (Figma 01a, 01b, 01h). */
export default function WelcomeScreen() {
  const { update } = useSettings();
  const [index, setIndex] = useState(0);
  const step = index === READY ? 'ready' : STEPS[index];

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
        <TopBar hideBack={index === 0} onBack={() => setIndex(index - 1)} />
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

      <View style={styles.bottom}>
        {step === 'welcome' && (
          <AppText variant="caption" color="inkSoft" style={styles.disclaimer}>
            For tracking only, not medical advice. Food results are AI-generated.
          </AppText>
        )}
        <Button
          label={step === 'welcome' ? 'Get started' : step === 'bellie' ? 'Continue' : 'Start logging'}
          onPress={() => (step === 'ready' ? finish() : setIndex(index + 1))}
        />
      </View>
    </Screen>
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
  disclaimer: { marginBottom: space.s2, textAlign: 'center' },
});
