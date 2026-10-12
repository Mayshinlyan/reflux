import { Pill } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { MEDICATION_TYPES, type MedicationType } from '@/constants/medicationTypes';
import { useDb } from '@/db/DatabaseProvider';
import { archiveMedication, createMedication, listMedications } from '@/db/repositories/medications';
import { logger } from '@/lib/logger';
import { radius, space, useColors } from '@/theme';

import { StepLayout } from './StepLayout';

/** Common reflux medications offered as one-tap adds; anything else is added later from Settings. */
const SUGGESTIONS: readonly { name: string; dose?: string; type: MedicationType }[] = [
  { name: 'Omeprazole', dose: '20mg', type: 'ppi' },
  { name: 'Famotidine', dose: '20mg', type: 'h2_blocker' },
  { name: 'Tums', type: 'antacid' },
  { name: 'Gaviscon', type: 'alginate' },
];

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const typeLabel = (type: MedicationType) => MEDICATION_TYPES.find((t) => t.key === type)?.label ?? type;

/**
 * The medications they take regularly (Figma 01f). Picks are only written on Continue (new ones created,
 * unpicked ones that were saved earlier archived), so going back and forth never leaves duplicates.
 */
export function MedicationsStep({ onNext }: { onNext: () => void }) {
  const colors = useColors();
  const db = useDb();
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        SUGGESTIONS.filter((s) => listMedications(db).some((med) => sameName(med.name, s.name))).map(
          (s) => s.name,
        ),
      ),
  );
  const [saveFailed, setSaveFailed] = useState(false);

  const toggle = (name: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(name)) next.add(name);
      return next;
    });

  const next = () => {
    try {
      const saved = listMedications(db);
      for (const suggestion of SUGGESTIONS) {
        const existing = saved.filter((med) => sameName(med.name, suggestion.name));
        if (selected.has(suggestion.name) && existing.length === 0) {
          createMedication(db, {
            name: suggestion.name,
            type: suggestion.type,
            defaultDose: suggestion.dose,
          });
        } else if (!selected.has(suggestion.name)) {
          for (const med of existing) archiveMedication(db, med.id);
        }
      }
    } catch (error) {
      logger.error('saveOnboardingMedications', error);
      setSaveFailed(true);
      return;
    }
    onNext();
  };

  return (
    <StepLayout
      title="Do you take any medication?"
      subtitle="Add the ones you take regularly, so logging a dose is one tap."
      saveFailed={saveFailed}
      footer={
        <>
          <Button label="Continue" onPress={next} />
          <Button label="Skip for now" variant="secondary" onPress={onNext} />
        </>
      }>
      <View style={styles.list}>
        {SUGGESTIONS.map((item) => {
          const added = selected.has(item.name);
          const title = item.dose ? `${item.name} ${item.dose}` : item.name;
          return (
            <Pressable
              key={item.name}
              accessibilityRole="checkbox"
              accessibilityLabel={`${title}, ${typeLabel(item.type)}`}
              accessibilityState={{ checked: added }}
              onPress={() => toggle(item.name)}
              style={[styles.row, { backgroundColor: colors.surface }]}>
              <View style={[styles.icon, { backgroundColor: colors.clayTint }]}>
                <Pill size={18} color={colors.clayInk} strokeWidth={2} />
              </View>
              <View style={styles.text}>
                <AppText variant="bodyEm">{title}</AppText>
                <AppText variant="caption" color="inkSoft">
                  {typeLabel(item.type)}
                </AppText>
              </View>
              <View style={[styles.pill, { backgroundColor: added ? colors.sageTint : colors.surface2 }]}>
                <AppText variant="label" style={{ color: added ? colors.sageInk : colors.ink }}>
                  {added ? 'Added' : 'Add'}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="caption" color="inkSoft" style={styles.note}>
        You can edit this list anytime in Settings.
      </AppText>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg },
  icon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  pill: {
    minWidth: 64,
    minHeight: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  note: { marginTop: space.s2 },
});
