import { Plus, X } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { shadow, space, useColors } from '@/theme';

import { ClockSolid, HouseSolid, type TabIconProps } from './TabIcons';

export type TabKey = 'log' | 'today' | 'history';

/** Bottom space a tab screen leaves so its content scrolls clear of the bar and the raised Log button (Figma: 130). */
export const TAB_BAR_CLEARANCE = 130;
/** The olive Log button, and how far it rises above the bar's top edge. */
export const LOG_BUTTON_SIZE = 64;
export const LOG_BUTTON_RAISE = 24;

const TAB_TARGET = 48;
const TOP_PAD = 8;
/**
 * Room under the icons. The home indicator sits inside the bar's bottom area, so only the inset beyond the 12 the
 * 48 target already leaves under its icon is added (at least 8): the icons look centred, not lofted up.
 */
const MIN_BOTTOM_PAD = 8;
const INDICATOR_OVERLAP = 12;
const BAR_RADIUS = space.s3;

export const tabBarBottomPadding = (bottomInset: number) =>
  Math.max(bottomInset - INDICATOR_OVERLAP, MIN_BOTTOM_PAD);
/** Height of the bar from the screen's bottom edge to its top edge (64 with no home indicator). */
export const tabBarHeight = (bottomInset: number) => TOP_PAD + TAB_TARGET + tabBarBottomPadding(bottomInset);

const TABS: { key: Exclude<TabKey, 'log'>; label: string; icon: ComponentType<TabIconProps> }[] = [
  { key: 'today', label: 'Today', icon: HouseSolid },
  { key: 'history', label: 'History', icon: ClockSolid },
];

type Props = {
  /** The screen you are on. `log` is an action, so it is never the "current" tab. */
  active: Exclude<TabKey, 'log'>;
  /** The quick log arch is open: the Log button shows a close icon. */
  logOpen?: boolean;
  /** The screen's bottom safe-area inset (the home indicator). */
  bottomInset: number;
  onSelect: (tab: TabKey) => void;
};

/**
 * Figma "Tab bar floating": a full-width `surface` bar on the bottom edge with rounded top corners. Today and
 * History are icon-only tabs of solid shapes with no backgrounds: the current one is `ink`, the other a
 * muted `inkMuted` silhouette (greyed out, 3:1 on the bar). The olive Log button sits raised in the middle so it reads as the one
 * action. Icon-only, so every button carries a label.
 */
export function FloatingTabBar({ active, logOpen = false, bottomInset, onSelect }: Props) {
  const colors = useColors();
  const LogIcon = logOpen ? X : Plus;
  const renderTab = ({ key, label, icon: Icon }: (typeof TABS)[number]) => {
    const isActive = key === active;
    return (
      <Pressable
        key={key}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: isActive }}
        onPress={() => onSelect(key)}
        style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.8 : 1 }]}>
        <Icon size={24} color={isActive ? colors.ink : colors.inkMuted} cutout={colors.surface} />
      </Pressable>
    );
  };
  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View
        accessibilityRole="tablist"
        style={[
          styles.bar,
          {
            backgroundColor: colors.surface,
            paddingBottom: tabBarBottomPadding(bottomInset),
            boxShadow: shadow.tabBar,
          },
        ]}>
        {renderTab(TABS[0])}
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.slot} />
        {renderTab(TABS[1])}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={logOpen ? 'Close' : 'Log'}
        accessibilityState={{ expanded: logOpen }}
        onPress={() => onSelect('log')}
        style={({ pressed }) => [
          styles.log,
          { backgroundColor: colors.cta, boxShadow: shadow.softLift, opacity: pressed ? 0.85 : 1 },
        ]}>
        <LogIcon size={32} color={colors.ctaInk} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // The raised button lives inside this padding so it stays within bounds and is tappable on Android.
  root: { paddingTop: LOG_BUTTON_RAISE },
  bar: {
    flexDirection: 'row',
    paddingTop: TOP_PAD,
    paddingHorizontal: space.s3,
    borderTopLeftRadius: BAR_RADIUS,
    borderTopRightRadius: BAR_RADIUS,
  },
  tab: { flex: 1, height: TAB_TARGET, alignItems: 'center', justifyContent: 'center' },
  slot: { width: LOG_BUTTON_SIZE },
  log: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -LOG_BUTTON_SIZE / 2,
    width: LOG_BUTTON_SIZE,
    height: LOG_BUTTON_SIZE,
    borderRadius: LOG_BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
