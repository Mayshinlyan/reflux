import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { Pencil } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, SectionList, StyleSheet, View } from 'react-native';

import type { ReactNode } from 'react';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SymptomChip } from '@/components/SymptomChip';
import { TagChip } from '@/components/TagChip';
import { TimelineItem } from '@/components/TimelineItem';
import { useToast } from '@/components/Toast';
import { useDb } from '@/db/DatabaseProvider';
import { deleteFoodLog, listDiaryFoodLogs } from '@/db/repositories/food';
import { deleteMedicationLog, listMedicationLogs } from '@/db/repositories/medications';
import { deleteSymptomLog, listSymptomLogs } from '@/db/repositories/symptoms';
import type { AppDb } from '@/db/types';
import { friendlyMessages } from '@/lib/errors';
import { dayLabel, localDayKey } from '@/lib/localDay';
import { logger } from '@/lib/logger';
import {
  buildTimeline,
  groupSymptoms,
  medicationTypeLabel,
  symptomLabel,
  tagLabel,
  type TimelineEntry,
  type TimelineFilter,
  type TimelineSection,
} from '@/lib/timeline';
import { radius, space, useColors } from '@/theme';

const FILTERS: { key: TimelineFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'symptom', label: 'Symptoms' },
  { key: 'food', label: 'Food' },
  { key: 'medication', label: 'Medications' },
];

/** How far back History loads. Older entries stay on the phone; paging comes later. */
const HISTORY_DAYS = 90;

function loadSections(db: AppDb, filter: TimelineFilter): TimelineSection[] {
  const now = new Date();
  // Pad both ends by a day so entries logged in far-off zones aren't clipped.
  const range = {
    from: new Date(now.getTime() - (HISTORY_DAYS + 1) * 86_400_000).toISOString(),
    to: new Date(now.getTime() + 86_400_000).toISOString(),
  };
  return buildTimeline(
    {
      symptoms: listSymptomLogs(db, range),
      food: listDiaryFoodLogs(db, range),
      medications: listMedicationLogs(db, range),
    },
    filter,
    now,
  );
}

export default function HistoryScreen() {
  const db = useDb();
  const toast = useToast();
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [sections, setSections] = useState<TimelineSection[]>([]);
  const [selected, setSelected] = useState<TimelineEntry | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  /** An entry waiting to open in the editor once the detail sheet has finished closing. */
  const pendingEdit = useRef<TimelineEntry | null>(null);

  const reload = useCallback(() => {
    try {
      setSections(loadSections(db, filter));
      setLoadFailed(false);
    } catch (error) {
      logger.error('loadHistory', error);
      // Say so, rather than showing "Nothing here yet" and making it look like data is gone.
      setLoadFailed(true);
    }
  }, [db, filter]);

  // Reload whenever History comes back into view (e.g. after editing an entry).
  useFocusEffect(reload);

  const confirmDelete = (entry: TimelineEntry) => {
    Alert.alert('Delete this entry?', "It will be removed from this phone. This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            if (entry.kind === 'symptom') deleteSymptomLog(db, entry.id);
            if (entry.kind === 'food') deleteFoodLog(db, entry.id);
            if (entry.kind === 'medication') deleteMedicationLog(db, entry.id);
          } catch (error) {
            logger.error('deleteEntry', error);
            Alert.alert("Couldn't delete", friendlyMessages.INTERNAL);
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          pendingEdit.current = null;
          setSelected(null);
          toast('Entry deleted');
          reload();
        },
      },
    ]);
  };

  // Open the editor only after the sheet has finished sliding away, so the new screen
  // doesn't push in underneath a closing modal.
  const edit = (entry: TimelineEntry) => {
    pendingEdit.current = entry;
    setSelected(null);
  };
  const closeSheet = () => {
    pendingEdit.current = null;
    setSelected(null);
  };
  const openPendingEdit = () => {
    const entry = pendingEdit.current;
    pendingEdit.current = null;
    if (entry) router.push({ pathname: '/log/symptoms', params: { id: String(entry.id) } });
  };

  return (
    <Screen style={styles.screen}>
      <BackHeader title="History" />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((option) => (
            <TagChip
              key={option.key}
              role="filter"
              label={option.label}
              selected={filter === option.key}
              onPress={() => setFilter(option.key)}
            />
          ))}
        </ScrollView>
      </View>

      <SectionList
        sections={sections.map((section) => ({ ...section, data: section.entries }))}
        keyExtractor={(entry) => `${entry.kind}-${entry.id}`}
        renderSectionHeader={({ section }) => (
          <AppText variant="label" color="inkSoft" accessibilityRole="header" style={styles.dayLabel}>
            {section.label}
          </AppText>
        )}
        renderItem={({ item }) => (
          <TimelineItem
            kind={item.kind}
            title={item.title}
            time={item.meta}
            onPress={() => setSelected(item)}
          />
        )}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppText variant="title" style={styles.emptyTitle}>
              {loadFailed ? "Couldn't load your history" : 'Nothing here yet'}
            </AppText>
            <AppText color="inkSoft" style={styles.emptyBody}>
              {loadFailed
                ? `${friendlyMessages.INTERNAL} Your entries are still on this phone.`
                : filter === 'all'
                  ? 'Tap Log on the home screen to add your first entry.'
                  : 'Nothing of this kind in the last three months.'}
            </AppText>
          </View>
        }
      />

      <BottomSheet visible={selected !== null} onClose={closeSheet} onDismissed={openPendingEdit}>
        {selected && <EntryDetail entry={selected} onEdit={edit} onDelete={confirmDelete} />}
      </BottomSheet>
    </Screen>
  );
}

function EntryDetail({
  entry,
  onEdit,
  onDelete,
}: {
  entry: TimelineEntry;
  onEdit: (entry: TimelineEntry) => void;
  onDelete: (entry: TimelineEntry) => void;
}) {
  const colors = useColors();
  const when = `${dayLabel(localDayKey(entry.at, entry.tz))} · ${entry.time}`;
  return (
    <View>
      {entry.kind === 'symptom' && (
        <>
          <AppText variant="title" accessibilityRole="header">
            Symptom entry
          </AppText>
          <AppText variant="caption" color="inkSoft" style={styles.when}>
            {when}
          </AppText>
          {groupSymptoms(entry.log.items).map((group) => (
            <DetailSection key={group.zone} title={`${group.label} · ${group.keys.length}`}>
              <View style={styles.chips}>
                {group.keys.map((key) => (
                  <SymptomChip key={key} label={symptomLabel(key)} selected readOnly />
                ))}
              </View>
            </DetailSection>
          ))}
          {entry.log.tags.length > 0 && (
            <DetailSection title="Anything else going on">
              <View style={styles.chips}>
                {entry.log.tags.map((tag) => (
                  <TagChip key={tag} label={tagLabel(tag)} selected readOnly />
                ))}
              </View>
            </DetailSection>
          )}
          {entry.log.notes ? (
            <DetailSection title="Your note">
              <View style={[styles.noteCard, { backgroundColor: colors.surface2 }]}>
                <AppText style={styles.noteText}>{entry.log.notes}</AppText>
              </View>
            </DetailSection>
          ) : null}
        </>
      )}
      {entry.kind === 'food' && (
        <>
          <AppText variant="title" accessibilityRole="header">
            {entry.log.mealName}
          </AppText>
          <AppText variant="caption" color="inkSoft" style={styles.when}>
            {when} · {entry.log.source === 'photo' ? 'photo' : 'typed'}
          </AppText>
        </>
      )}
      {entry.kind === 'medication' && (
        <>
          <AppText variant="title" accessibilityRole="header">
            {entry.title}
          </AppText>
          <AppText variant="caption" color="inkSoft" style={styles.when}>
            {medicationTypeLabel(entry.log.type)} · {when}
          </AppText>
        </>
      )}

      <View style={styles.actions}>
        {entry.kind === 'symptom' && (
          <Button label="Edit entry" icon={Pencil} onPress={() => onEdit(entry)} />
        )}
        <Button label="Delete" variant="quietDanger" onPress={() => onDelete(entry)} />
      </View>
    </View>
  );
}

/** A small heading over a group of chips (or the note) in the entry detail. */
function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="label" color="inkSoft" accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  filters: { gap: space.s1, paddingBottom: space.s1 },
  list: { paddingBottom: space.s4, flexGrow: 1 },
  dayLabel: { marginTop: 20, marginBottom: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.s3 },
  emptyTitle: { marginBottom: space.s1 },
  emptyBody: { textAlign: 'center' },
  when: { marginTop: 4, marginBottom: 14 },
  section: { marginTop: space.s2 },
  sectionTitle: { marginBottom: space.s1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 },
  noteCard: { borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12 },
  noteText: { fontSize: 15, lineHeight: 22 },
  actions: { gap: space.s1, marginTop: space.s3 },
});
