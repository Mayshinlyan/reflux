import { Camera, Check, type LucideIcon, Shield } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { radius, space, useColors } from '@/theme';

import { AppText } from './AppText';

const POINTS: readonly { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Shield, title: 'Stored on your phone', body: 'Your entries never leave your device.' },
  {
    icon: Camera,
    title: 'Meal checks use AI',
    body: 'Only the photo or description you add is sent to check a meal.',
  },
  {
    icon: Check,
    title: 'Not medical advice',
    body: 'a day in my belly gives general guidance. Talk to your doctor about your symptoms.',
  },
];

/** What happens to their data, and that this isn't medical advice (onboarding and Settings). */
export function PrivacyPoints() {
  const colors = useColors();
  return (
    <View style={styles.list}>
      {POINTS.map(({ icon: Icon, title, body }) => (
        <View key={title} style={styles.row}>
          <View style={[styles.icon, { backgroundColor: colors.surface2 }]}>
            <Icon size={20} color={colors.ink} strokeWidth={2} />
          </View>
          <View style={styles.text}>
            <AppText variant="bodyEm">{title}</AppText>
            <AppText variant="caption" color="inkSoft">
              {body}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.s2 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.s2 },
  icon: { width: 42, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
