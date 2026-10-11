import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { minTouchTarget, useColors } from '@/theme';

import { AppText } from './AppText';

type Props = { label: string; checked: boolean; onToggle: () => void };

/** Figma "Checkbox row": a 20pt box (outlined when off, olive when on) and a caption-size label. */
export function CheckboxRow({ label, checked, onToggle }: Props) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      style={styles.row}>
      {/* The box outline is a functional stroke: it is what says "tick me". */}
      <View
        style={[
          styles.box,
          checked ? { backgroundColor: colors.cta } : { borderWidth: 1.5, borderColor: colors.inkSoft },
        ]}>
        {checked && <Check size={14} color={colors.ctaInk} strokeWidth={3} />}
      </View>
      <AppText variant="caption">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: minTouchTarget },
  box: { width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
});
