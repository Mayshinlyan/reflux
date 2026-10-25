import { StyleSheet } from 'react-native';

import { space } from '@/theme';

import { AppText } from './AppText';

/** Small muted heading between form sections (the mockup's `.section-title`). */
export function SectionTitle({ children, first }: { children: string; first?: boolean }) {
  return (
    <AppText
      variant="label"
      color="inkSoft"
      accessibilityRole="header"
      style={[styles.title, first && styles.first]}>
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  // The settings row above a title already leaves 12, so the title adds 20 to make the 32 between groups.
  title: { marginTop: space.s4 - 12, marginBottom: space.s1_5 },
  first: { marginTop: 0 },
});
