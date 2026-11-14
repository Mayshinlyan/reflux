import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { friendlyMessages } from '@/lib/errors';
import { space } from '@/theme';

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** The buttons under the content, pinned to the bottom. */
  footer: ReactNode;
  /** Saving this step's answer failed; shows the usual message above the buttons. */
  saveFailed?: boolean;
  /** Centres the content in the room between the heading and the buttons (a picture, not a list). */
  centerBody?: boolean;
};

/** An onboarding question: title, a warm line under it, the answer, and buttons pinned below (Figma 01c to 01g). */
export function StepLayout({ title, subtitle, children, footer, saveFailed, centerBody }: Props) {
  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, centerBody && styles.grow]}
        showsVerticalScrollIndicator={false}>
        <AppText variant="display" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="voiceSmall" color="inkSoft" style={styles.subtitle}>
            {subtitle}
          </AppText>
        ) : null}
        <View style={[styles.body, centerBody && styles.centered]}>{children}</View>
      </ScrollView>
      <View style={styles.footer}>
        {saveFailed && (
          <AppText color="redInk" style={styles.error}>
            {friendlyMessages.INTERNAL}
          </AppText>
        )}
        {footer}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingTop: space.s4 },
  subtitle: { marginTop: space.s1 },
  body: { marginTop: space.s3 },
  grow: { flexGrow: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: space.s3 },
  footer: { paddingTop: space.s2, paddingBottom: space.s3, gap: space.s1 },
  error: { textAlign: 'center' },
});
