import { CalendarDays, type LucideIcon, Plus, Sun, User } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, shadow, useColors } from '@/theme';

export type TabKey = 'log' | 'today' | 'history' | 'you';

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'log', label: 'Log', icon: Plus },
  { key: 'today', label: 'Today', icon: Sun },
  { key: 'history', label: 'History', icon: CalendarDays },
  { key: 'you', label: 'You', icon: User },
];

type Props = {
  /** The screen you are on. `log` is an action, so it is never the "current" tab. */
  active: Exclude<TabKey, 'log'>;
  onSelect: (tab: TabKey) => void;
};

/**
 * Figma "Tab bar floating": a `surface` pill with four icon buttons. Log is always the olive primary
 * action; the current tab rests on a `surface2` pill. Icon-only, so every button carries a label.
 */
export function FloatingTabBar({ active, onSelect }: Props) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.bar, { backgroundColor: colors.surface, boxShadow: shadow.softLift }]}>
      {TABS.map(({ key, label, icon: Icon }) => {
        const isLog = key === 'log';
        const isActive = key === active;
        return (
          <Pressable
            key={key}
            accessibilityRole={isLog ? 'button' : 'tab'}
            accessibilityLabel={label}
            accessibilityState={isLog ? undefined : { selected: isActive }}
            onPress={() => onSelect(key)}
            style={({ pressed }) => [
              styles.tab,
              {
                backgroundColor: isLog ? colors.cta : isActive ? colors.surface2 : 'transparent',
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            <Icon size={24} color={isLog ? colors.ctaInk : colors.ink} strokeWidth={2} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
    borderRadius: radius.pill,
  },
  tab: {
    flex: 1,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
