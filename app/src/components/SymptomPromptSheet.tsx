import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '@/theme';

import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { Button } from './Button';

/** Longer than the sheet's slide-out, so the sheet's own close callback normally wins. */
const CLOSE_BACKSTOP_MS = 800;

type Props = {
  visible: boolean;
  /** What was just logged, e.g. "Lunch logged". */
  subtitle: string;
  /** The sheet should close. Called for every way out, before `onLog` or `onSkip`. */
  onHide: () => void;
  /** "Log symptoms" was chosen. Runs once the sheet has finished closing. */
  onLog: () => void;
  /** "Not now" (or the scrim) was chosen. Runs once the sheet has finished closing. */
  onSkip: () => void;
};

/**
 * The question after a meal or dose is logged: do you want to log symptoms now? Either answer
 * runs after the sheet has closed, so navigating never pushes a screen under a closing modal.
 */
export function SymptomPromptSheet({ visible, subtitle, onHide, onLog, onSkip }: Props) {
  const logChosen = useRef(false);
  const answered = useRef(true);
  const backstop = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(backstop.current), []);

  /** Runs the answer once, whichever of the sheet's close callback or the backstop gets there first. */
  const finish = () => {
    if (answered.current) return;
    answered.current = true;
    clearTimeout(backstop.current);
    if (logChosen.current) onLog();
    else onSkip();
  };

  const choose = (log: boolean) => {
    logChosen.current = log;
    answered.current = false;
    onHide();
    // The close callback is the normal trigger; this keeps the answer from being lost if it never comes.
    backstop.current = setTimeout(finish, CLOSE_BACKSTOP_MS);
  };

  return (
    <BottomSheet visible={visible} onClose={() => choose(false)} onDismissed={finish}>
      <AppText variant="section" accessibilityRole="header">
        Any symptoms?
      </AppText>
      <AppText variant="label" color="inkSoft">
        {subtitle}
      </AppText>
      <View style={styles.actions}>
        <Button label="Log symptoms" onPress={() => choose(true)} />
        <Button label="Not now" variant="secondary" onPress={() => choose(false)} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: { marginTop: space.s3, gap: space.s2 },
});
