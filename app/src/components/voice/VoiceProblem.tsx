import { Mic, MicOff, WifiOff } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import type { VoiceProblem as Problem } from '@/services/voice';
import { radius, space, useColors } from '@/theme';

import { TypeInstead } from './TypeInstead';

/** Figma 45e, 45f, 45g: what went wrong in one warm line, one way to fix it, and typing as the way out. */
const COPY: Record<Problem, { title: string; body: string; action: string; icon: typeof Mic }> = {
  permission: {
    title: 'Mic is off',
    body: 'Turn on the microphone for this app in Settings, or type instead.',
    action: 'Open Settings',
    icon: MicOff,
  },
  nothing: {
    title: "Didn't catch that",
    body: 'Try again, a little closer to the phone.',
    action: 'Talk again',
    icon: Mic,
  },
  offline: {
    title: 'No signal',
    body: 'I need the internet to work out what you said. Your words are kept.',
    action: 'Try again',
    icon: WifiOff,
  },
};

type Props = { problem: Problem; onAction: () => void; onTypeInstead: () => void };

export function VoiceProblem({ problem, onAction, onTypeInstead }: Props) {
  const colors = useColors();
  const { title, body, action, icon: Icon } = COPY[problem];
  return (
    <>
      <View style={styles.body}>
        <View style={[styles.circle, { backgroundColor: colors.cta }]} accessibilityElementsHidden>
          <Icon size={56} color={colors.ctaInk} strokeWidth={2} />
        </View>
        <AppText variant="hero" accessibilityRole="header" style={styles.centre}>
          {title}
        </AppText>
        <AppText color="inkSoft" style={[styles.centre, styles.text]}>
          {body}
        </AppText>
      </View>
      <View style={styles.footer}>
        <Button label={action} onPress={onAction} />
        <TypeInstead onPress={onTypeInstead} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s2 },
  circle: {
    width: 120,
    height: 120,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: { textAlign: 'center' },
  text: { paddingHorizontal: space.s3 },
  footer: { paddingTop: space.s2, paddingBottom: space.s1, gap: space.s1 },
});
