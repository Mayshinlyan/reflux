import { StyleSheet, View } from 'react-native';

import { BODY_ZONES } from '@/constants/bodyZones';
import { SYMPTOM_ITEMS, type SymptomKey } from '@/constants/symptomItems';
import { space } from '@/theme';

import { AppText } from './AppText';
import { SymptomChip } from './SymptomChip';

const labelOf = (key: SymptomKey) => SYMPTOM_ITEMS.find((item) => item.key === key)?.label ?? key;

type Props = {
  selected: ReadonlySet<SymptomKey>;
  onToggle: (key: SymptomKey) => void;
};

/** Every symptom, grouped by body area (Throat & voice, Chest, Tummy), as chips to toggle. */
export function SymptomZones({ selected, onToggle }: Props) {
  return (
    <>
      {BODY_ZONES.map((zone, index) => (
        <View key={zone.key} style={index > 0 && styles.zone}>
          <AppText variant="section">{zone.label}</AppText>
          <View style={styles.chips}>
            {zone.symptoms.map((key) => (
              <SymptomChip
                key={key}
                label={labelOf(key)}
                selected={selected.has(key)}
                onToggle={() => onToggle(key)}
              />
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

/** The display name of a symptom, for read-only chips elsewhere. */
export { labelOf as symptomLabel };

const styles = StyleSheet.create({
  zone: { marginTop: space.s3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1, marginTop: 12 },
});
