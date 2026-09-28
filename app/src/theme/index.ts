import { lightColors } from './colors';

export * from './colors';
export * from './spacing';
export * from './typography';

/**
 * MVP is light mode only. When dark mode lands (M2), swap this for a hook that
 * picks `darkColors` from the color scheme; components already read colors from here.
 */
export function useColors() {
  return lightColors;
}
