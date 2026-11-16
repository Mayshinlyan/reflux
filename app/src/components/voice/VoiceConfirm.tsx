import { ChevronDown } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { TagChip } from '@/components/TagChip';
import { type LoggedSymptomKey } from '@/constants/symptomItems';
import { formatMealTime } from '@/lib/mealTime';
import { symptomLabel } from '@/lib/timeline';
import { type HeardMeal, mealTitle } from '@/services/voice';
import { cardEdge, radius, space, typography, useColors } from '@/theme';

type Props = {
  meals: HeardMeal[];
  symptoms: LoggedSymptomKey[];
  /** When the symptoms were felt, shown only when no meal was said; null means now. */
  at: Date | null;
  onFixFood: (meal: number, index: number) => void;
  onFixSymptom: (key: LoggedSymptomKey) => void;
  /** The meal whose time to change, or null for the symptoms' own time. */
  onFixTime: (meal: number | null) => void;
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

/** A meal's card: its title and, at the right, its time as plain text with a chevron (tap to change it), then its foods. */
function MealCard({
  meal,
  onFixFood,
  onFixTime,
}: {
  meal: HeardMeal;
  onFixFood: (index: number) => void;
  onFixTime: () => void;
}) {
  const colors = useColors();
  const when = formatMealTime(meal.at, new Date());
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      <View style={styles.mealHeader}>
        <AppText variant="sectionSm">{mealTitle(meal)}</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${mealTitle(meal)} time, ${when}. Change it`}
          onPress={onFixTime}
          hitSlop={8}
          style={styles.time}>
          <AppText variant="small" color="inkSoft">
            {when}
          </AppText>
          <ChevronDown size={18} color={colors.inkSoft} strokeWidth={2} />
        </Pressable>
      </View>
      <View style={styles.chips}>
        {meal.foods.map((food, index) => (
          <TagChip
            key={`${index}:${food}`}
            label={food}
            selected={false}
            onCard
            role="button"
            onPress={() => onFixFood(index)}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Figma 45d and 49: "Did I get that?" One card for each meal heard (its own title, time and foods), one for how
 * you feel, and, when nothing was eaten, one for when. Every chip is a button that opens its fixing sheet (45h to
 * 45j), and a meal's time opens the time sheet for that meal. Nothing is saved until "Save".
 */
export function VoiceConfirm({
  meals,
  symptoms,
  at,
  onFixFood,
  onFixSymptom,
  onFixTime,
  onSave,
  onTalkAgain,
  saving,
}: Props) {
  const nothing = meals.length === 0 && symptoms.length === 0;
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
        {meals.map((meal, mealIndex) => (
          <MealCard
            key={mealIndex}
            meal={meal}
            onFixFood={(index) => onFixFood(mealIndex, index)}
            onFixTime={() => onFixTime(mealIndex)}
          />
        ))}
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
        {meals.length === 0 && symptoms.length > 0 && (
          <HeardCard title="When">
            <TagChip
              label={formatMealTime(at, new Date())}
              selected={false}
              onCard
              role="button"
              onPress={() => onFixTime(null)}
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
  // Figma 49: the heading row is 38 tall, like a chip, with the time at the far end.
  mealHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 38 },
  time: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footer: { paddingTop: space.s2, paddingBottom: space.s1, gap: space.s1 },
});
