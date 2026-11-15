import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { TagChip } from '@/components/TagChip';
import { type LoggedSymptomKey } from '@/constants/symptomItems';
import { formatMealTime } from '@/lib/mealTime';
import { symptomLabel } from '@/lib/timeline';
import { cardEdge, radius, space, typography, useColors } from '@/theme';

type Props = {
  foods: string[];
  symptoms: LoggedSymptomKey[];
  /** When it was; null means now. */
  at: Date | null;
  onFixFood: (index: number) => void;
  onFixSymptom: (key: LoggedSymptomKey) => void;
  onFixTime: () => void;
  onSave: () => void;
  onTalkAgain: () => void;
  saving: boolean;
};

function HeardCard({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      <AppText variant="sectionSm">{title}</AppText>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

/**
 * Figma 45d: "Did I get that?" One card each for what was heard as food, how you feel and when. Every chip is a
 * button that opens its fixing sheet (45h to 45j). Nothing is saved until "Save".
 */
export function VoiceConfirm({
  foods,
  symptoms,
  at,
  onFixFood,
  onFixSymptom,
  onFixTime,
  onSave,
  onTalkAgain,
  saving,
}: Props) {
  const nothing = foods.length === 0 && symptoms.length === 0;
  return (
    <>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <AppText variant="hero" accessibilityRole="header">
          Did I get that?
        </AppText>
        <AppText variant="voice" color="inkSoft" style={styles.subtitle}>
          Tap anything to fix it.
        </AppText>
        {foods.length > 0 && (
          <HeardCard title="Food">
            {foods.map((food, index) => (
              <TagChip
                key={`${index}:${food}`}
                label={food}
                selected={false}
                onCard
                role="button"
                onPress={() => onFixFood(index)}
              />
            ))}
          </HeardCard>
        )}
        {symptoms.length > 0 && (
          <HeardCard title="How you feel">
            {symptoms.map((key) => (
              <TagChip
                key={key}
                label={symptomLabel(key)}
                selected={false}
                onCard
                role="button"
                onPress={() => onFixSymptom(key)}
              />
            ))}
          </HeardCard>
        )}
        {!nothing && (
          <HeardCard title="When">
            <TagChip
              label={formatMealTime(at, new Date())}
              selected={false}
              onCard
              role="button"
              onPress={onFixTime}
            />
          </HeardCard>
        )}
        {nothing && (
          <AppText color="inkSoft" style={typography.body}>
            Nothing left to save. Talk again, or go back.
          </AppText>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Save" onPress={onSave} disabled={nothing || saving} />
        <Button variant="quiet" label="Talk again" onPress={onTalkAgain} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: space.s2, paddingBottom: space.s3 },
  subtitle: { marginBottom: space.s1 },
  card: { borderRadius: radius.lg, padding: space.s2, gap: space.s1_5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 },
  footer: { paddingTop: space.s2, paddingBottom: space.s1, gap: space.s1 },
});
