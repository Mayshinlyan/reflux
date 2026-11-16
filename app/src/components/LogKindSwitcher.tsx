import { createContext, type ReactNode, useContext } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { LOG_KINDS, type LogKind } from '@/lib/logKinds';
import { minTouchTarget, useColors } from '@/theme';

import { AppText } from './AppText';

const SwitchKindContext = createContext<((kind: LogKind) => void) | null>(null);

/** Lets the Food, How I feel and Medication screens switch to each other inside one modal (`/log/type`). */
export function SwitchKindProvider({
  onSwitch,
  children,
}: {
  onSwitch: (kind: LogKind) => void;
  children: ReactNode;
}) {
  return <SwitchKindContext.Provider value={onSwitch}>{children}</SwitchKindContext.Provider>;
}

/** True when this screen sits inside the tabbed log, so it can show the tabs. */
export function useCanSwitchKind(): boolean {
  return useContext(SwitchKindContext) !== null;
}

/**
 * Figma 48b to 48d: Food · How I feel · Medication as full-width underline tabs under the Back row of the three
 * manual log screens. The selected tab is ink with a 2pt olive underline; a 1pt edge line runs under all three.
 * Picking another kind swaps the content of the one modal they live in, with no navigation and no animation, like
 * switching tabs. `confirmLeave` is true once something has been typed or picked, so switching asks before it
 * throws that away. Renders nothing outside the tabbed log.
 */
export function LogKindSwitcher({
  current,
  confirmLeave = false,
}: {
  current: LogKind;
  confirmLeave?: boolean;
}) {
  const colors = useColors();
  const onSwitch = useContext(SwitchKindContext);
  if (!onSwitch) return null;

  const pick = (kind: LogKind) => {
    if (kind === current) return;
    if (!confirmLeave) return onSwitch(kind);
    Alert.alert('Switch without saving?', "What you've entered here won't be saved.", [
      { text: 'Stay', style: 'cancel' },
      { text: 'Switch', style: 'destructive', onPress: () => onSwitch(kind) },
    ]);
  };

  return (
    <View accessibilityRole="tablist" style={[styles.row, { borderBottomColor: colors.edge }]}>
      {LOG_KINDS.map(({ kind, label }) => {
        const selected = kind === current;
        return (
          <Pressable
            key={kind}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => pick(kind)}
            style={styles.tab}>
            <AppText variant="bodyEm" color={selected ? 'ink' : 'inkSoft'}>
              {label}
            </AppText>
            <View style={[styles.underline, selected && { backgroundColor: colors.sageInk }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', height: 48, borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: minTouchTarget },
  /** Sits on the row's bottom edge, over the 1pt line. */
  underline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2 },
});
