import { Check } from 'lucide-react-native';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space, typography, useColors } from '@/theme';

const ToastContext = createContext<(message: string) => void>(() => {});

/** Shows a short confirmation ("Symptoms logged") near the bottom of the screen. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(next);
    AccessibilityInfo.announceForAccessibility(next);
    timer.current = setTimeout(() => setMessage(null), 2200);
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
        <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 96 }]}>
          <Animated.View
            entering={FadeInDown.duration(200)}
            exiting={FadeOut.duration(200)}
            style={[styles.toast, { backgroundColor: colors.ink }]}>
            <Check size={16} color={colors.bg} strokeWidth={2.6} />
            <Animated.Text style={[styles.text, { color: colors.bg }]}>{message}</Animated.Text>
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
});
