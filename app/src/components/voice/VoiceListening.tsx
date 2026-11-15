import type { SharedValue } from 'react-native-reanimated';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { FoodLoading } from '@/components/FoodLoading';
import { space } from '@/theme';

import { TypeInstead } from './TypeInstead';
import { VoiceWave } from './VoiceWave';

type Props = {
  /** Listening: the wave moves with the voice, and no words show. Working: the pot loader, while Bellie hears and sorts it out. */
  phase: 'listening' | 'working';
  /** How loud the voice is, 0 to 1; drives the wave. */
  level: SharedValue<number>;
  onDone: () => void;
  onTypeInstead: () => void;
};

/**
 * Figma 45b and 45c. Listening is a wave that moves with your voice, "Done" and "Type instead"; the words are not
 * shown while you talk (a live transcript flickers and invites fixing as you go). Working is the app's own
 * steaming-pot loader, unchanged.
 */
export function VoiceListening({ phase, level, onDone, onTypeInstead }: Props) {
  const listening = phase === 'listening';
  return (
    <>
      <View style={styles.body}>
        <AppText variant="hero" accessibilityRole="header" style={styles.centre}>
          {listening ? "I'm listening" : 'Got it'}
        </AppText>
        <AppText variant="voice" color="inkSoft" style={styles.centre}>
          {listening ? 'Say what you ate or how you feel.' : 'Just a moment.'}
        </AppText>
        <View style={styles.middle}>
          {listening ? <VoiceWave level={level} onPress={onDone} /> : <FoodLoading source="voice" />}
        </View>
      </View>
      {listening && (
        <View style={styles.footer}>
          <Button label="Done" onPress={onDone} />
          <TypeInstead onPress={onTypeInstead} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, paddingTop: space.s3, gap: space.s1 },
  centre: { textAlign: 'center' },
  // The wave (or the loader and the words) sits in the middle of whatever room is left, so the gaps above and below match.
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingTop: space.s2, paddingBottom: space.s1, gap: space.s1 },
});
