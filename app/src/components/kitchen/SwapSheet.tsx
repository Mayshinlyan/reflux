import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { AppError, type ErrorCode } from '@/lib/errors';
import { ideasErrorMessage } from '@/lib/kitchenCopy';
import { formatMinutes } from '@/lib/recipe';
import { cardEdge, minTouchTarget, radius, space, useColors } from '@/theme';
import type { Recipe } from '@/types/recipe';

type State = { status: 'loading' | 'ready' | 'error'; recipes: Recipe[]; code?: ErrorCode };

type Props = {
  visible: boolean;
  onClose: () => void;
  /** "Swap Monday dinner". */
  title: string;
  /** Asks for three alternatives. Keep it stable (useCallback) so the sheet asks once per opening. */
  load: (signal: AbortSignal) => Promise<Recipe[]>;
  onPick: (recipe: Recipe) => void;
};

/**
 * "Swap Monday dinner" (Figma "meal planning flow" D2): three other dishes that still fit, each with "Use". It asks
 * when it opens, shows the shape of the list while it waits, and offers Try again if that failed. Give it a new `key`
 * for each meal it opens for, so it always starts on the waiting list.
 */
export function SwapSheet({ visible, onClose, title, load, onPick }: Props) {
  const colors = useColors();
  const [state, setState] = useState<State>({ status: 'loading', recipes: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    load(controller.signal).then(
      (recipes) => {
        if (!controller.signal.aborted) setState({ status: 'ready', recipes });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', recipes: [], code: error instanceof AppError ? error.code : 'INTERNAL' });
      },
    );
    return () => controller.abort();
  }, [visible, load, attempt]);

  return (
    <BottomSheet visible={visible} onClose={onClose} tone="bg">
      <View style={styles.header}>
        <View style={styles.titles}>
          <AppText variant="displaySmall" accessibilityRole="header">
            {title}
          </AppText>
          <AppText variant="caption" color="inkMuted">
            Each one skips your foods to avoid
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={(minTouchTarget - 36) / 2}
          style={[styles.close, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
          <X size={18} color={colors.ink} strokeWidth={2} />
        </Pressable>
      </View>

      {state.status === 'error' ? (
        <View style={styles.error}>
          <AppText color="inkSoft">{ideasErrorMessage(state.code ?? 'INTERNAL')}</AppText>
          <Button
            label="Try again"
            onPress={() => {
              setState({ status: 'loading', recipes: [] });
              setAttempt((count) => count + 1);
            }}
          />
        </View>
      ) : (
        <View style={styles.list} accessibilityLiveRegion="polite">
          {state.status === 'loading'
            ? [0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[styles.row, { backgroundColor: colors.surface, ...cardEdge(colors) }]}
                  accessibilityLabel="Looking for another dish">
                  <View style={styles.main}>
                    <View style={[styles.lineLong, { backgroundColor: colors.surface2 }]} />
                    <View style={[styles.lineShort, { backgroundColor: colors.surface2 }]} />
                  </View>
                </View>
              ))
            : state.recipes.map((recipe) => (
                <View
                  key={recipe.title}
                  style={[styles.row, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
                  <View style={styles.main}>
                    <AppText variant="bodyEm" numberOfLines={1}>
                      {recipe.title}
                    </AppText>
                    <AppText variant="caption" color="inkMuted" numberOfLines={1}>
                      {formatMinutes(recipe.minutes)}, {recipe.why}
                    </AppText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Use ${recipe.title}`}
                    onPress={() => onPick(recipe)}
                    hitSlop={4}
                    style={[styles.use, { backgroundColor: colors.sageTint }]}>
                    <AppText variant="label" color="sageInk">
                      Use
                    </AppText>
                  </Pressable>
                </View>
              ))}
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.s1, marginBottom: space.s2 },
  titles: { flex: 1, gap: 4 },
  close: { width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  list: { gap: space.s1, marginBottom: space.s1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1_5,
    paddingHorizontal: space.s2,
    paddingVertical: space.s1_5,
    borderRadius: radius.md,
    minHeight: 64,
  },
  main: { flex: 1, gap: 2 },
  use: {
    minHeight: minTouchTarget - 8,
    paddingHorizontal: space.s2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineLong: { width: '70%', height: 16, borderRadius: 8 },
  lineShort: { width: '45%', height: 12, borderRadius: 6, marginTop: 6 },
  error: { gap: space.s2, marginBottom: space.s1 },
});
