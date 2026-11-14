import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { Button } from '@/components/Button';
import { GiftArt } from '@/components/completion/GiftBox';
import { space } from '@/theme';

import { StepLayout } from './StepLayout';

const BELLIE = 224;
const GIFT = 96;

/**
 * Check in and Bellie leaves gifts (Figma G18): a picture of Bellie in a hat beside a wrapped gift, and where to find
 * them. It sits right after "what you get". The picture is centred between the heading and Continue.
 */
export function GiftsStep({ onNext }: { onNext: () => void }) {
  return (
    <StepLayout
      title="Check in, and get gifts to customize Bellie."
      subtitle="Hats, glasses and more, yours to put on her."
      centerBody
      footer={<Button label="Continue" onPress={onNext} />}>
      <View
        style={styles.picture}
        accessible
        accessibilityLabel="Bellie wearing a little hat, next to a wrapped gift">
        <Belly size={BELLIE} stage="little" mood="happy" worn={['hat']} />
        <View style={styles.gift}>
          <GiftArt size={GIFT} />
        </View>
      </View>
      <AppText variant="voiceSmall" color="inkSoft" style={styles.caption}>
        Find them in Customize Bellie, on your profile.
      </AppText>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  picture: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: space.s1 },
  gift: { marginBottom: space.s1 },
  caption: { marginTop: space.s3, textAlign: 'center' },
});
