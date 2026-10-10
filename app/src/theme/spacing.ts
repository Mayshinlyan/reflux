import { Platform } from 'react-native';

/** 8pt grid, from the style guide's --s1..--s5. */
export const space = { s1: 8, s2: 16, s3: 24, s4: 32, s5: 48 } as const;

export const radius = { sm: 10, md: 16, lg: 20, pill: 999 } as const;

/** Figma "Belly/Soft lift": the one shadow, for floating buttons, the tab bar and menus. */
export const shadow = {
  softLift: '0px 6px 16px -6px rgba(46, 42, 38, 0.18)',
} as const;

/** Platform-specific minimum touch target: 44pt on iOS, 48dp on Android. */
export const minTouchTarget = Platform.select({ ios: 44, default: 48 });

/** Minimum gap between adjacent touchables. */
export const touchGap = 8;
