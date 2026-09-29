import { StyleSheet, View } from 'react-native';

import { space } from '@/theme';

import { AppText } from './AppText';
import { BackHeader } from './BackHeader';
import { Screen } from './Screen';

type Props = { title: string; body: string };

/** Temporary screen for routes whose feature lands in a later build step. */
export function PlaceholderScreen({ title, body }: Props) {
  return (
    <Screen>
      <BackHeader title={title} />
      <View style={styles.center}>
        <AppText color="inkSoft" style={styles.body}>
          {body}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: space.s5 },
  body: { textAlign: 'center' },
});
