import { Plus, X } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useTabBarPress } from '@/hooks/useTabBarPress';
import { shadow, space, useColors } from '@/theme';

import { ClockSolid, HouseSolid, type TabIconProps } from './TabIcons';

export type TabKey = 'log' | 'today' | 'history';

/** The olive Log button, the cream ring around it, and how far the ring rises above the pill's top edge. */
const LOG_BUTTON_SIZE = 56;
const LOG_RING = 5;
const LOG_OUTER = LOG_BUTTON_SIZE + LOG_RING * 2;
export const LOG_BUTTON_RAISE = 20;
/** The Log button's centre sits this far below the pill's top edge. */
export const LOG_CENTRE_BELOW_BAR_TOP = LOG_OUTER / 2 - LOG_BUTTON_RAISE;

const PILL_WIDTH = 264;
const PILL_HEIGHT = 64;
const PILL_PAD = 8;
const TAB_WIDTH = 88;
const TAB_HEIGHT = 48;
const SLOT_WIDTH = 72;
const HIGHLIGHT = 44;
/** The highlight is centred on the current tab. History's is one tab width plus the Log slot further right. */
const HIGHLIGHT_LEFT = PILL_PAD + (TAB_WIDTH - HIGHLIGHT) / 2;
const HIGHLIGHT_TRAVEL = TAB_WIDTH + SLOT_WIDTH;
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
 * Figma "Tab bar floating": a compact `surface` pill centred above the bottom edge. Today and History are
 * icon-only tabs of solid shapes: the current one is `ink` on a small tan `surface2` circle, the other a muted
 * `inkMuted` silhouette; it just changes tab, it never slides. The olive Log button, ringed in the page colour, rises
 * over the pill's top edge. While a tab is pressed the whole pill grows a little and springs back on release (see
 * `useTabBarPress`). Icon-only, so every button carries a label.
 */
export function FloatingTabBar({ active, logOpen = false, bottomInset, onSelect }: Props) {
  const colors = useColors();
  const press = useTabBarPress();
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
        onPressIn={press.pressIn}
        onPressOut={press.pressOut}
        style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.8 : 1 }]}>
        <Icon
          size={24}
          color={isActive ? colors.ink : colors.inkMuted}
          cutout={isActive ? colors.surface2 : colors.surface}
        />
      </Pressable>
    );
  };
  return (
    <View pointerEvents="box-none" style={[styles.root, { paddingBottom: tabBarGap(bottomInset) }]}>
      <Animated.View
        accessibilityRole="tablist"
        style={[styles.pill, { backgroundColor: colors.surface, boxShadow: shadow.tabBar }, press.pillStyle]}>
        <View
          testID="tab-highlight"
          pointerEvents="none"
          style={[
            styles.highlight,
            {
              backgroundColor: colors.surface2,
              left: HIGHLIGHT_LEFT + (active === 'history' ? HIGHLIGHT_TRAVEL : 0),
            },
          ]}
        />
        {renderTab(TABS[0])}
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.slot} />
        {renderTab(TABS[1])}
      </Animated.View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={logOpen ? 'Close' : 'Log'}
        accessibilityState={{ expanded: logOpen }}
        onPress={() => onSelect('log')}
        style={({ pressed }) => [
          styles.log,
          {
            backgroundColor: colors.cta,
            borderColor: colors.bg,
            boxShadow: shadow.softLift,
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        <LogIcon size={28} color={colors.ctaInk} strokeWidth={2} />
      </Pressable>
    </View>
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
  log: {
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -LOG_OUTER / 2,
    width: LOG_OUTER,
    height: LOG_OUTER,
    borderRadius: LOG_OUTER / 2,
    borderWidth: LOG_RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
