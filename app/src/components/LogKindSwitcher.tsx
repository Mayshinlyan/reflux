import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { LOG_KINDS, type LogKind } from '@/lib/logKinds';
import { minTouchTarget, useColors } from '@/theme';

import { AppText } from './AppText';

const LOG_ROUTE = {
  food: '/log/food',
  symptoms: '/log/symptoms',
  medication: '/log/medication',
} as const satisfies Record<LogKind, string>;

/**
 * Figma 48b to 48d: Food · How I feel · Medication as full-width underline tabs under the Back row of the three
 * manual log screens. The selected tab is ink with a 2pt olive underline; a 1pt edge line runs under all three.
 * Picking another kind swaps the screen in place (the log stays one modal) and keeps the day being logged.
 * `confirmLeave` is true once something has been typed or picked, so switching asks before it throws that away.
 */
export function LogKindSwitcher({
  current,
  date,
  confirmLeave = false,
}: {
  current: LogKind;
  /** A day tapped in Today's week strip, handed on to the other screens. */
  date?: string;
  confirmLeave?: boolean;
}) {
  const colors = useColors();

  const open = (kind: LogKind) => {
    router.replace(date ? { pathname: LOG_ROUTE[kind], params: { date } } : LOG_ROUTE[kind]);
  };
  const pick = (kind: LogKind) => {
    if (kind === current) return;
    if (!confirmLeave) return open(kind);
    Alert.alert('Switch without saving?', "What you've entered here won't be saved.", [
      { text: 'Stay', style: 'cancel' },
      { text: 'Switch', style: 'destructive', onPress: () => open(kind) },
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
