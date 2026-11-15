import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LOADING_STEP_MS, type LoadingSource, loadingMessage } from '@/lib/loadingMessages';
import { radius, space } from '@/theme';

import { AppText } from './AppText';
import { PotLoader } from './PotLoader';

type Props = {
  source: LoadingSource;
  /** Shown as a small preview while a photo is being looked at. */
  photoUri?: string;
  /** A quieter line under the changing words (how long it takes). */
  note?: string;
};

/**
 * The wait while the relay works: a little pot that bobs and steams, with reassuring lines that
 * change every few seconds. Motion stops (the pot and the words stay) when reduced motion is on.
 */
export function FoodLoading({ source, photoUri, note }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((current) => current + 1), LOADING_STEP_MS);
    return () => clearInterval(timer);
  }, []);

  const message = loadingMessage(step, source);
  return (
    <View style={styles.wrap} accessible accessibilityLiveRegion="polite" accessibilityLabel={message}>
      {photoUri ? (
        <Image
          source={{ uri: photoUri }}
          style={styles.photo}
          contentFit="cover"
          accessibilityElementsHidden
        />
      ) : null}
      <PotLoader />
      <AppText color="inkSoft" style={styles.message}>
        {message}
      </AppText>
      {note ? (
        <AppText variant="caption" color="inkMuted" style={styles.message}>
          {note}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: space.s2, paddingVertical: space.s4 },
  photo: { width: 120, height: 120, borderRadius: radius.lg },
  message: { textAlign: 'center' },
});
