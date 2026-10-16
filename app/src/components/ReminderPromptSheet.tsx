import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '@/theme';

import { AppText } from './AppText';
import { Belly } from './Belly';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

/** Longer than the sheet's slide-out, so the sheet's own close callback normally wins. */
const CLOSE_BACKSTOP_MS = 800;

type Props = {
  visible: boolean;
  /** The sheet should close. Called for every way out, before `onYes` or `onNotNow`. */
  onHide: () => void;
  /** "Yes please" was chosen. Runs once the sheet has finished closing, so the phone's own prompt can show. */
  onYes: () => void;
  /** "Not now" (or the scrim) was chosen. */
  onNotNow: () => void;
};

/**
 * Offers the check-in reminder once, after a few meals (Figma 08c), for anyone who skipped it in onboarding. The
 * answer runs after the sheet has closed: the phone can't show its permission prompt over a closing modal.
 */
export function ReminderPromptSheet({ visible, onHide, onYes, onNotNow }: Props) {
  const yesChosen = useRef(false);
  const answered = useRef(true);
  const backstop = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(backstop.current), []);

  /** Runs the answer once, whichever of the sheet's close callback or the backstop gets there first. */
  const finish = () => {
    if (answered.current) return;
    answered.current = true;
    clearTimeout(backstop.current);
    if (yesChosen.current) onYes();
    else onNotNow();
  };

  const choose = (yes: boolean) => {
    yesChosen.current = yes;
    answered.current = false;
    onHide();
    backstop.current = setTimeout(finish, CLOSE_BACKSTOP_MS);
  };

  return (
    <BottomSheet visible={visible} onClose={() => choose(false)} onDismissed={finish} tone="bg">
      <View style={styles.center}>
        <Belly size={72} />
        <AppText variant="displaySmall" accessibilityRole="header" style={styles.text}>
          Want a gentle nudge?
        </AppText>
        <AppText color="inkSoft" style={styles.text}>
          I can ask how you’re feeling about 2 hours after a meal. It stays on your phone, and you can change
          it in Settings.
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button label="Yes please" onPress={() => choose(true)} />
        <Button label="Not now" variant="secondary" onPress={() => choose(false)} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: space.s1 + 4, paddingTop: space.s1 },
  text: { textAlign: 'center' },
  actions: { marginTop: space.s3, gap: space.s1 + 4 },
});
