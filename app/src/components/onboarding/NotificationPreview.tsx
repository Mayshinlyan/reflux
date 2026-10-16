import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Belly } from '@/components/Belly';
import { CHECK_IN_TITLE, checkInBody } from '@/lib/reminderTiming';
import { useColors } from '@/theme';

/** What the reminder looks like, so people see what they are agreeing to (Figma 01h, 08d). The phone draws the real one. */
export function NotificationPreview() {
  const colors = useColors();
  const body = checkInBody('Spicy chicken tacos', 120);
  return (
    <View
      accessible
      accessibilityLabel={`Example reminder. ${CHECK_IN_TITLE} ${body}`}
      style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={[styles.icon, { backgroundColor: colors.bg }]}>
        <Belly size={30} />
      </View>
      <View style={styles.text}>
        <View style={styles.top}>
          <AppText variant="caption" color="inkMuted" style={styles.app}>
            a day in my belly
          </AppText>
          <AppText variant="caption" color="inkMuted">
            now
          </AppText>
        </View>
        <AppText variant="label" style={styles.title}>
          {CHECK_IN_TITLE}
        </AppText>
        <AppText variant="caption" color="inkSoft">
          {body}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 22 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  top: { flexDirection: 'row', alignItems: 'center' },
  app: { flex: 1 },
  title: { fontSize: 15, lineHeight: 20 },
});
