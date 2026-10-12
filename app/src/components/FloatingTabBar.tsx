import { CalendarDays, type LucideIcon, Plus, Sun, User } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { radius, shadow, useColors } from '@/theme';

export type TabKey = 'log' | 'today' | 'history' | 'you';

/** Bottom space a tab screen leaves so its content scrolls clear of the floating bar (Figma: 130). */
export const TAB_BAR_CLEARANCE = 130;
export const TAB_BAR_HEIGHT = 60;
/** How far the bar floats above the screen's bottom edge: the home indicator's inset, but at least 16. */
export const tabBarBottomOffset = (bottomInset: number) => Math.max(bottomInset, 16);

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
 * Figma "Tab bar floating": a `surface` pill with three icon tabs (the current one rests on `surface2`),
 * and the Log action as its own olive circle beside it so it reads as an action, not a fourth tab.
 * Icon-only, so every button carries a label.
 */
export function FloatingTabBar({ active, onSelect }: Props) {
  const colors = useColors();
  const tabs = TABS.filter((tab) => tab.key !== 'log');
  return (
    <View style={styles.row}>
      <View
        accessibilityRole="tablist"
        style={[styles.bar, { backgroundColor: colors.surface, boxShadow: shadow.softLift }]}>
        {tabs.map(({ key, label, icon: Icon }) => {
          const isActive = key === active;
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: isActive }}
              onPress={() => onSelect(key)}
              style={({ pressed }) => [
                styles.tab,
                { backgroundColor: isActive ? colors.surface2 : 'transparent', opacity: pressed ? 0.8 : 1 },
              ]}>
              <Icon size={24} color={colors.ink} strokeWidth={2} />
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log"
        onPress={() => onSelect('log')}
        style={({ pressed }) => [
          styles.log,
          { backgroundColor: colors.cta, boxShadow: shadow.softLift, opacity: pressed ? 0.85 : 1 },
        ]}>
        <Plus size={24} color={colors.ctaInk} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bar: {
    flex: 1,
    height: TAB_BAR_HEIGHT,
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
  log: { width: 60, height: 60, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
