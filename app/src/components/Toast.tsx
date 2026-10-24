import { Check } from 'lucide-react-native';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabBarClearance } from '@/components/FloatingTabBar';
import { radius, space, typography, useColors } from '@/theme';

type ToastOptions = {
  /** Show under the status bar, level with the top bar, for a screen whose bottom is busy. */
  top?: boolean;
  /** A button on the toast ("Undo"). The toast then stays longer and can be tapped. */
  action?: { label: string; onPress: () => void };
};

const TOAST_MS = 2200;
const ACTION_TOAST_MS = 5000;

const ToastContext = createContext<(message: string, options?: ToastOptions) => void>(() => {});

/** Shows a short confirmation ("Symptoms logged") near the bottom of the screen. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const [top, setTop] = useState(false);
  const [action, setAction] = useState<ToastOptions['action']>();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: string, options?: ToastOptions) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(next);
    setTop(Boolean(options?.top));
    setAction(options?.action);
    AccessibilityInfo.announceForAccessibility(
      options?.action ? `${next}. ${options.action.label} available` : next,
    );
    timer.current = setTimeout(() => setMessage(null), options?.action ? ACTION_TOAST_MS : TOAST_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && (
        <View
          pointerEvents={action ? 'box-none' : 'none'}
          style={[
            styles.wrap,
            top ? { top: insets.top + space.s2 } : { bottom: tabBarClearance(insets.bottom) },
          ]}>
          <Animated.View
            entering={FadeInDown.duration(200)}
            // Leaves the way it came: sliding back down as it fades.
            exiting={FadeOutDown.duration(200)}
            style={[styles.toast, { backgroundColor: colors.ink }]}>
            {!action && <Check size={16} color={colors.bg} strokeWidth={2.6} />}
            <Animated.Text style={[styles.text, { color: colors.bg }]}>{message}</Animated.Text>
            {action && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={action.label}
                hitSlop={12}
                onPress={() => {
                  if (timer.current) clearTimeout(timer.current);
                  setMessage(null);
                  action.onPress();
                }}
                style={({ pressed }) => [styles.action, { opacity: pressed ? 0.6 : 1 }]}>
                <Animated.Text style={[styles.text, { color: colors.honeyTint }]}>
                  {action.label}
                </Animated.Text>
              </Pressable>
            )}
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
  },
  text: { ...typography.label, fontSize: 14 },
  action: { marginLeft: space.s1 + 4 },
});
