import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ellipsis, Pencil, Trash2 } from 'lucide-react-native';
import { type ReactNode, useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionMenu } from '@/components/ActionMenu';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SymptomChip } from '@/components/SymptomChip';
import { TagChip } from '@/components/TagChip';
import { BackHeader } from '@/components/BackHeader';
import { TopBarButton } from '@/components/TopBar';
import { VerdictBadge } from '@/components/VerdictBadge';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { getFoodLog, listMealTags } from '@/db/repositories/food';
import { isFoodSaved } from '@/db/repositories/savedFoods';
import { listSymptomLogsForMeal } from '@/db/repositories/symptoms';
import { useDeleteEntry } from '@/hooks/useDeleteEntry';
import { type LoadedEntry, loadEntry } from '@/lib/entry';
import { logger } from '@/lib/logger';
import { formatTime, formatWhen } from '@/lib/localDay';
import { isLateMeal } from '@/lib/mealTiming';
import { possibleCauses } from '@/lib/possibleCauses';
import { medicationTypeLabel, symptomLabel, tagLabel } from '@/lib/timeline';
import { matchedTriggerLabels } from '@/lib/verdictReasons';
import { radius, space, useColors } from '@/theme';

/**
 * One diary entry in full (Figma 04b meal, 04f dose, 04h symptoms): a close X and a `…` menu on top, then the
 * entry's cards. Edit and Delete live in the menu, so nothing else competes with what was logged.
 */
export default function EntryScreen() {
  const db = useDb();
  const params = useLocalSearchParams<{ kind?: string; id?: string }>();
  const load = useCallback((): LoadedEntry | undefined => {
    try {
      return loadEntry(db, params.kind, params.id);
    } catch (error) {
      // Treated like a missing entry: the screen explains it instead of crashing.
      logger.error('loadEntry', error);
      return undefined;
    }
  }, [db, params.kind, params.id]);
  const [entry, setEntry] = useState<LoadedEntry | undefined>(load);
  const [menuOpen, setMenuOpen] = useState(false);

  // Back from the editor lands here, so show what was just saved.
  useFocusEffect(
    useCallback(() => {
      setEntry(load());
    }, [load]),
  );

  const confirmDelete = useDeleteEntry(() => router.back());

  const edit = () => {
    setMenuOpen(false);
    if (!entry) return;
    router.push(
      entry.kind === 'symptom'
        ? { pathname: '/log/symptoms', params: { id: String(entry.log.id) } }
        : { pathname: '/entry/edit', params: { kind: entry.kind, id: String(entry.log.id) } },
    );
  };
  const remove = () => {
    setMenuOpen(false);
    if (entry) confirmDelete({ kind: entry.kind, id: entry.log.id });
  };

  if (!entry) {
    return (
      <Screen>
        <BackHeader close />
        <View style={styles.missing}>
          <AppText variant="title" style={styles.missingTitle}>
            This entry isn&apos;t here any more
          </AppText>
          <AppText color="inkSoft" style={styles.missingBody}>
            It may have been deleted.
          </AppText>
          <Button label="Back to History" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackHeader
        close
        right={<TopBarButton icon={Ellipsis} label="More" onPress={() => setMenuOpen(true)} />}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {entry.kind === 'food' && <MealView log={entry.log} />}
        {entry.kind === 'symptom' && <SymptomView log={entry.log} />}
        {entry.kind === 'medication' && <DoseView log={entry.log} />}
      </ScrollView>

      <EntryMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          { label: 'Edit entry', icon: Pencil, onPress: edit },
          { label: 'Delete entry', icon: Trash2, onPress: remove, destructive: true },
        ]}
      />
    </Screen>
  );
}

/** Figma 04c: the action menu floating under the `…` button, over a dimmed page. */
function EntryMenu({
  visible,
  onClose,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  items: Parameters<typeof ActionMenu>[0]['items'];
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close menu"
        onPress={onClose}
        style={styles.scrim}
      />
      {/* Just under the top bar: safe area, the screen's top padding, the 44pt bar and a small gap. */}
      <View pointerEvents="box-none" style={[styles.menuPos, { top: insets.top + space.s2 + 44 + space.s1 }]}>
        <ActionMenu items={items} />
      </View>
    </Modal>
  );
}

function Card({ title, children }: { title?: string; children: ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      {title ? (
        <AppText variant="section" accessibilityRole="header">
          {title}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

/** "Label ... value" inside a Details card. */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <AppText variant="small">{label}</AppText>
      <AppText variant="small" color="inkSoft">
        {value}
      </AppText>
    </View>
  );
}

function Heading({ children, badge }: { children: string; badge?: ReactNode }) {
  return (
    <View style={styles.heading}>
      {badge}
      <AppText variant="hero" accessibilityRole="header">
        {children}
      </AppText>
    </View>
  );
}

function Tags({ labels }: { labels: string[] }) {
  if (labels.length === 0) return null;
  return (
    <View style={styles.chips}>
      {labels.map((label) => (
        <TagChip key={label} label={label} selected={false} readOnly onCard />
      ))}
    </View>
  );
}

function NoteCard({ notes }: { notes: string | null }) {
  return notes ? (
    <Card title="Note">
      <AppText variant="small">{notes}</AppText>
    </Card>
  ) : null;
}

const PORTION_LABELS = { small: 'Small', regular: 'Regular', large: 'Large' } as const;

function MealView({ log }: { log: Extract<LoadedEntry, { kind: 'food' }>['log'] }) {
  const db = useDb();
  const { settings } = useSettings();
  const late = isLateMeal(log.loggedAt, log.tz, settings.bedtime, settings.lateMealWindowMinutes);
  const lifestyle = listMealTags(db, log.id).map(tagLabel);
  const triggers = log.analysis ? matchedTriggerLabels(log.analysis, { late }) : late ? ['Late meal'] : [];
  const tags = [...new Set([...lifestyle, ...triggers])];
  const after = listSymptomLogsForMeal(db, log.id);
  const keys = [...new Set(after.flatMap((symptoms) => symptoms.items.map((item) => item.key)))];
  const first = after[0];
  return (
    <>
      <Heading badge={log.overallVerdict ? <VerdictBadge verdict={log.overallVerdict} /> : undefined}>
        {log.mealName}
      </Heading>
      <Card>
        <AppText variant="bodyEm">{formatWhen(log.loggedAt, log.tz)}</AppText>
        <Tags labels={tags} />
      </Card>
      <Card title="Details">
        <DetailRow label="Portion" value={PORTION_LABELS[log.portion ?? 'regular']} />
        <DetailRow label="Saved to My foods" value={isFoodSaved(db, log.mealName) ? 'Yes' : 'No'} />
      </Card>
      {keys.length > 0 && first && (
        <Card title="Symptoms">
          <View style={styles.chips}>
            {keys.map((key) => (
              <SymptomChip key={key} label={symptomLabel(key)} selected readOnly />
            ))}
          </View>
          <AppText variant="caption" color="inkSoft">
            {`Logged at ${formatTime(first.loggedAt, first.tz)}`}
          </AppText>
        </Card>
      )}
      <NoteCard notes={log.notes} />
    </>
  );
}

function SymptomView({ log }: { log: Extract<LoadedEntry, { kind: 'symptom' }>['log'] }) {
  const db = useDb();
  const { settings } = useSettings();
  const meal = log.foodLogId !== null ? getFoodLog(db, log.foodLogId) : undefined;
  const tags = log.tags.map(tagLabel);
  const causes = possibleCauses({
    symptomAt: log.loggedAt,
    meal,
    bedtime: settings.bedtime,
    lateMealWindowMinutes: settings.lateMealWindowMinutes,
  });
  return (
    <>
      <Heading>{log.items.map((item) => symptomLabel(item.key)).join(', ')}</Heading>
      <Card>
        <AppText variant="bodyEm">{formatWhen(log.loggedAt, log.tz)}</AppText>
        <Tags labels={tags} />
      </Card>
      <Card title="Symptoms">
        <View style={styles.chips}>
          {log.items.map((item) => (
            <SymptomChip key={item.key} label={symptomLabel(item.key)} selected readOnly />
          ))}
        </View>
        {meal && (
          <AppText variant="caption" color="inkSoft">
            {`After ${meal.mealName}`}
          </AppText>
        )}
      </Card>
      {causes.length > 0 && (
        <Card title="Possibly related">
          {causes.map((cause) => (
            <AppText key={cause} variant="small">
              {cause}
            </AppText>
          ))}
          <AppText variant="caption" color="inkSoft">
            Worked out on your phone from what you logged. Not a diagnosis.
          </AppText>
        </Card>
      )}
      <NoteCard notes={log.notes} />
    </>
  );
}

function DoseView({ log }: { log: Extract<LoadedEntry, { kind: 'medication' }>['log'] }) {
  return (
    <>
      <Heading>{log.doseText ? `${log.name} ${log.doseText}` : log.name}</Heading>
      <Card>
        <AppText variant="bodyEm">{formatWhen(log.takenAt, log.tz)}</AppText>
      </Card>
      <Card title="Details">
        <DetailRow label="Type" value={medicationTypeLabel(log.type)} />
      </Card>
      <NoteCard notes={log.notes} />
    </>
  );
}

const styles = StyleSheet.create({
  content: { gap: space.s3, paddingBottom: space.s4 },
  heading: { gap: space.s2 },
  card: { borderRadius: radius.lg, padding: space.s2, gap: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.s1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(58,47,37,0.45)' },
  menuPos: { position: 'absolute', right: space.s3 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.s3 },
  missingTitle: { marginBottom: space.s1, textAlign: 'center' },
  missingBody: { marginBottom: space.s3, textAlign: 'center' },
});
