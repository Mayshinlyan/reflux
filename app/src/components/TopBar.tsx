import { router } from 'expo-router';
import { ChevronLeft, type LucideIcon, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, useColors } from '@/theme';

import { AppText } from './AppText';

const SIZE = 44;

/** Width of the back/more circle, so other things in the bar (the onboarding progress bar) can sit beside it. */
export const TOP_BAR_BUTTON_SIZE = SIZE;

type ButtonProps = { icon: LucideIcon; label: string; onPress: () => void };

/** The 44pt filled circle used at either end of the top bar (back, more). */
export function TopBarButton({ icon: Icon, label, onPress }: ButtonProps) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Icon size={22} color={colors.ink} strokeWidth={2} />
    </Pressable>
  );
}

type Props = {
  /** Centered title; omit for a bare bar. */
  title?: string;
  /** Replaces the default back behaviour (go back, or home when there is no history). */
  onBack?: () => void;
  /** Hide the back button, for the root of a tab. */
  hideBack?: boolean;
  /** A close X instead of the back arrow, for a screen that ends the flow rather than stepping back. */
  close?: boolean;
  /** Control at the far end, usually a `TopBarButton`. */
  right?: ReactNode;
};

/** Figma "Top bar": a back circle, an optional centered title and an optional circle on the right. */
export function TopBar({ title, onBack, hideBack = false, close = false, right }: Props) {
  return (
    <View style={styles.bar}>
      {hideBack ? (
        <View style={styles.spacer} />
      ) : (
        <TopBarButton
          icon={close ? X : ChevronLeft}
          label={close ? 'Close' : 'Back'}
          onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        />
      )}
      {title ? (
        <View pointerEvents="none" style={styles.titleWrap}>
          <AppText variant="title" accessibilityRole="header" numberOfLines={1} style={styles.title}>
            {title}
          </AppText>
        </View>
      ) : null}
      {right ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: SIZE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { width: SIZE, height: SIZE },
  // Centered on the bar, clear of the two circles.
  titleWrap: {
    position: 'absolute',
    left: SIZE + 8,
    right: SIZE + 8,
    alignItems: 'center',
  },
  title: { textAlign: 'center' },
});
