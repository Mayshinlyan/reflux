import { router } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { radius, space, useColors } from '@/theme';

export default function WelcomeScreen() {
  const colors = useColors();

  // Step 2 persists "onboarding done"; Step 5 creates the anonymous session here.
  const getStarted = () => router.replace('/');

  return (
    <Screen style={styles.container}>
      <View style={styles.top}>
        <Svg width={64} height={64} viewBox="0 0 44 44" style={styles.mark} accessibilityElementsHidden>
          <Path d="M22 4C13 12 8 20 8 27a14 14 0 0 0 28 0c0-7-5-15-14-23Z" fill={colors.sage} />
        </Svg>
        <AppText variant="display" accessibilityRole="header" style={styles.title}>
          A calmer way to track reflux
        </AppText>
        <AppText color="inkSoft">
          Log symptoms, check foods before you eat them, and see your own patterns — all on your phone.
        </AppText>
        <View style={[styles.privacy, { backgroundColor: colors.sageTint }]}>
          <ShieldCheck size={18} color={colors.sageInk} strokeWidth={2} />
          <AppText variant="label" color="sageInk">
            Your data stays on your phone
          </AppText>
        </View>
      </View>

      <View>
        <AppText variant="caption" color="inkSoft" style={styles.disclaimer}>
          For tracking only, not medical advice. Food results are AI-generated.
        </AppText>
        <Button label="Get started" onPress={getStarted} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'space-between' },
  top: { paddingTop: space.s5 },
  mark: { marginBottom: space.s3 },
  title: { marginBottom: space.s2 },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.s1,
    marginTop: space.s3,
    paddingVertical: space.s1,
    paddingHorizontal: space.s2,
    borderRadius: radius.pill,
  },
  disclaimer: { marginBottom: space.s2, textAlign: 'center' },
});
