import { StyleSheet } from 'react-native';

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
  title: { marginTop: 22, marginBottom: 10 },
  first: { marginTop: 0 },
});
