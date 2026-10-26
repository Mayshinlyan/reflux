import { Plus, X } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useTabBarPress } from '@/hooks/useTabBarPress';
import { shadow, space, useColors } from '@/theme';

import { ClockSolid, GearSolid, HouseSolid, PersonSolid, type TabIconProps } from './TabIcons';

export type TabKey = 'log' | 'today' | 'history' | 'profile' | 'settings';

/** The olive Log button, the cream ring around it, and how far the ring rises above the pill's top edge. */
const LOG_BUTTON_SIZE = 56;
const LOG_RING = 5;
const LOG_OUTER = LOG_BUTTON_SIZE + LOG_RING * 2;
export const LOG_BUTTON_RAISE = 20;
/** The Log button's centre sits this far below the pill's top edge. */
export const LOG_CENTRE_BELOW_BAR_TOP = LOG_OUTER / 2 - LOG_BUTTON_RAISE;

const PILL_WIDTH = 344;
const PILL_HEIGHT = 64;
const PILL_PAD = 8;
const TAB_WIDTH = 64;
const TAB_HEIGHT = 48;
const SLOT_WIDTH = 72;
const HIGHLIGHT = 44;
/** Two tabs, the Log slot, two tabs. The highlight is centred on the current tab, so it sits one Log slot further right on the last two. */
const highlightLeft = (index: number) =>
  PILL_PAD + index * TAB_WIDTH + (index >= 2 ? SLOT_WIDTH : 0) + (TAB_WIDTH - HIGHLIGHT) / 2;
/** Room under the pill: the home indicator sits inside the part of the inset beyond 12, with at least 16 of air. */
const MIN_GAP = 16;
const INDICATOR_OVERLAP = 12;

export const tabBarGap = (bottomInset: number) => Math.max(bottomInset - INDICATOR_OVERLAP, MIN_GAP);
/** Height from the screen's bottom edge to the pill's top edge (80 with no home indicator). */
export const tabBarHeight = (bottomInset: number) => tabBarGap(bottomInset) + PILL_HEIGHT;

/** Bottom space a tab screen leaves so its content scrolls clear of the pill and the raised Log button, plus a gap. */
export const tabBarClearance = (bottomInset: number) =>
  tabBarHeight(bottomInset) + LOG_BUTTON_RAISE + space.s2;

const TABS: { key: Exclude<TabKey, 'log'>; label: string; icon: ComponentType<TabIconProps> }[] = [
  { key: 'today', label: 'Today', icon: HouseSolid },
  { key: 'history', label: 'History', icon: ClockSolid },
  { key: 'profile', label: 'Profile', icon: PersonSolid },
  { key: 'settings', label: 'Settings', icon: GearSolid },
];

export type TargetRect = { x: number; y: number; width: number; height: number };

/**
 * Where a tab button (or the Log button with its ring) sits on a screen of this size, so the app tour can
 * spotlight it without measuring. The pill is centred, its bottom `tabBarGap` above the screen's bottom edge.
 */
export function tabTargetRect(
  key: TabKey,
  screen: { width: number; height: number },
  bottomInset: number,
): TargetRect {
  const pillTop = screen.height - tabBarGap(bottomInset) - PILL_HEIGHT;
  if (key === 'log') {
    const centreY = pillTop + LOG_CENTRE_BELOW_BAR_TOP;
    return {
      x: (screen.width - LOG_OUTER) / 2,
      y: centreY - LOG_OUTER / 2,
      width: LOG_OUTER,
      height: LOG_OUTER,
    };
  }
  const index = TABS.findIndex((tab) => tab.key === key);
  return {
    x: (screen.width - PILL_WIDTH) / 2 + PILL_PAD + index * TAB_WIDTH + (index >= 2 ? SLOT_WIDTH : 0),
    y: pillTop + PILL_PAD,
    width: TAB_WIDTH,
    height: TAB_HEIGHT,
  };
}

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
 * Figma "Tab bar floating": a compact `surface` pill centred above the bottom edge. Today, History, Profile and
 * Settings are icon-only tabs of solid shapes (two either side of the Log slot): the current one is `ink` on a small tan `surface2` circle, the other a muted
 * `inkMuted` silhouette; it just changes tab, it never slides. The olive Log button, ringed in the page colour, rises
 * over the pill's top edge. A pressed tab's icon shrinks a little and eases back on release (see `useTabBarPress`),
 * as does the Log button. Icon-only, so every button carries a label.
 */
export function FloatingTabBar({ active, logOpen = false, bottomInset, onSelect }: Props) {
  const colors = useColors();
  const logPress = useTabBarPress();
  const LogIcon = logOpen ? X : Plus;
  const renderTab = ({ key, label, icon: Icon }: (typeof TABS)[number]) => (
    <TabButton key={key} label={label} icon={Icon} active={key === active} onPress={() => onSelect(key)} />
  );
  return (
    <View pointerEvents="box-none" style={[styles.root, { paddingBottom: tabBarGap(bottomInset) }]}>
      <View
        accessibilityRole="tablist"
        style={[styles.pill, { backgroundColor: colors.surface, boxShadow: shadow.tabBar }]}>
        <View
          testID="tab-highlight"
          pointerEvents="none"
          style={[
            styles.highlight,
            {
              backgroundColor: colors.surface2,
              left: highlightLeft(TABS.findIndex((tab) => tab.key === active)),
            },
          ]}
        />
        {TABS.slice(0, 2).map(renderTab)}
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.slot} />
        {TABS.slice(2).map(renderTab)}
      </View>
      <Animated.View style={[styles.logWrap, logPress.style]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={logOpen ? 'Close' : 'Log'}
          accessibilityState={{ expanded: logOpen }}
          onPress={() => onSelect('log')}
          onPressIn={logPress.pressIn}
          onPressOut={logPress.pressOut}
          style={[
            styles.log,
            { backgroundColor: colors.cta, borderColor: colors.bg, boxShadow: shadow.softLift },
          ]}>
          <LogIcon size={28} color={colors.ctaInk} strokeWidth={2} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

type TabButtonProps = {
  label: string;
  icon: ComponentType<TabIconProps>;
  active: boolean;
  onPress: () => void;
};

/** One tab: its icon shrinks under a finger, so the press is felt on the thing you touched, not the whole bar. */
function TabButton({ label, icon: Icon, active, onPress }: TabButtonProps) {
  const colors = useColors();
  const press = useTabBarPress();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      onPressIn={press.pressIn}
      onPressOut={press.pressOut}
      style={styles.tab}>
      <Animated.View style={press.style}>
        <Icon
          size={24}
          color={active ? colors.ink : colors.inkMuted}
          cutout={active ? colors.surface2 : colors.surface}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The raised button lives inside this padding so it stays within bounds and is tappable on Android.
  root: { paddingTop: LOG_BUTTON_RAISE, alignItems: 'center' },
  pill: {
    width: PILL_WIDTH,
    height: PILL_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PILL_PAD,
    borderRadius: PILL_HEIGHT / 2,
  },
  highlight: {
    position: 'absolute',
    top: (PILL_HEIGHT - HIGHLIGHT) / 2,
    width: HIGHLIGHT,
    height: HIGHLIGHT,
    borderRadius: HIGHLIGHT / 2,
  },
  tab: { width: TAB_WIDTH, height: TAB_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  slot: { width: SLOT_WIDTH },
  logWrap: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -LOG_OUTER / 2,
    width: LOG_OUTER,
    height: LOG_OUTER,
  },
  log: {
    width: LOG_OUTER,
    height: LOG_OUTER,
    borderRadius: LOG_OUTER / 2,
    borderWidth: LOG_RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
