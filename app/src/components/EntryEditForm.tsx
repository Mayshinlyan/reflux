import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { MAX_MEAL_NAME, type StoredFoodLog, type FoodLogEdit, updateFoodLog } from '@/db/repositories/food';
import { updateMedicationLogTime } from '@/db/repositories/medications';
import type { MedicationLog } from '@/db/schema';
import { useDb } from '@/db/DatabaseProvider';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { effectiveVerdict } from '@/lib/verdict';
import { analyzeFood } from '@/services/relayClient';
import { space } from '@/theme';
import type { AppVerdict, Portion } from '@/types/analysis';

import { AppText } from './AppText';
import { Button } from './Button';
import { PortionSelect } from './PortionSelect';
import { TextField } from './TextField';
import { TimeField } from './TimeField';
import { useToast } from './Toast';
import { VerdictSelect } from './VerdictSelect';

type Props = {
  onSaved: () => void;
  onCancel: () => void;
} & ({ kind: 'food'; log: StoredFoodLog } | { kind: 'medication'; log: MedicationLog });

/** Edits a past meal or dose in place, inside History's entry sheet. Nothing is stored until Save. */
export function EntryEditForm(props: Props) {
  return props.kind === 'food' ? <FoodEdit {...props} /> : <MedicationEdit {...props} />;
}

/**
 * A meal's name, portion, verdict and time. A new portion re-checks the meal with the AI on Save (the photo,
 * or what was typed), so the verdict matches it; a verdict chosen here still sits on top of the new one.
 */
function FoodEdit({
  log,
  onSaved,
  onCancel,
}: {
  log: StoredFoodLog;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const db = useDb();
  const toast = useToast();
  const originalVerdict = log.analysis ? effectiveVerdict(log.analysis) : null;
  const originalPortion: Portion = log.portion ?? 'regular';
  const [name, setName] = useState(log.mealName);
  const [portion, setPortion] = useState<Portion>(originalPortion);
  const [verdict, setVerdict] = useState<AppVerdict | null>(originalVerdict);
  const [at, setAt] = useState(() => new Date(log.loggedAt));
  const [checking, setChecking] = useState(false);
  const alive = useAlive();
  const trimmedName = name.trim();
  // A meal saved without a verdict has nothing to re-check, so its portion is just noted.
  const recheck = portion !== originalPortion && log.analysis !== null;

  // A ref, not state, so a quick second tap can't start a second re-check before the re-render.
  const saving = useRef(false);

  const save = async () => {
    if (!trimmedName || saving.current) return;
    saving.current = true;
    const edit: FoodLogEdit = { name: trimmedName, portion };
    if (at.getTime() !== new Date(log.loggedAt).getTime()) edit.loggedAt = at.toISOString();
    if (recheck) {
      setChecking(true);
      try {
        const portionExtra = portion !== 'regular' ? { portion } : {};
        const { meta, ...analysis } = await analyzeFood(
          log.photoUri
            ? { photo: { uri: log.photoUri, mimeType: 'image/jpeg' }, ...portionExtra }
            : { text: log.inputText ?? log.mealName, ...portionExtra },
        );
        if (!alive.current) return;
        edit.check = { analysis, meta };
      } catch (caught) {
        if (!alive.current) return;
        const error = caught instanceof AppError ? caught : new AppError('INTERNAL');
        logger.error('analyzeFood', error);
        // The edits stay so the user can try again.
        toast(error.friendlyMessage);
        saving.current = false;
        setChecking(false);
        return;
      }
    }
    // A verdict changed here overrides. One the user set earlier is kept over a re-check's new verdict, since
    // it is their own judgement; with no override, the re-check's verdict stands.
    const earlierOverride = log.analysis?.overall.userVerdict;
    if (verdict && verdict !== originalVerdict) edit.verdict = verdict;
    else if (edit.check && earlierOverride) edit.verdict = earlierOverride;
    try {
      updateFoodLog(db, log.id, edit);
    } catch (error) {
      logger.error('updateFoodLog', error);
      toast("We couldn't save that. Please try again.");
      saving.current = false;
      if (alive.current) setChecking(false);
      return;
    }
    toast(recheck ? 'Changes saved. Verdict updated for the new portion.' : 'Changes saved');
    onSaved();
  };

  return (
    <View>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        Edit meal
      </AppText>
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        maxLength={MAX_MEAL_NAME}
        returnKeyType="done"
      />
      <PortionSelect value={portion} onChange={setPortion} />
      {verdict && <VerdictSelect value={verdict} onChange={setVerdict} />}
      <TimeField label="Eaten" value={at} onChange={setAt} />
      <View style={styles.actions}>
        <Button
          label={checking ? 'Checking…' : 'Save'}
          onPress={() => void save()}
          disabled={!trimmedName || checking}
        />
        <Button label="Cancel" variant="quietDanger" onPress={onCancel} disabled={checking} />
      </View>
    </View>
  );
}

/** When a dose was taken: the only thing about a past dose that can be wrong. */
function MedicationEdit({
  log,
  onSaved,
  onCancel,
}: {
  log: MedicationLog;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const db = useDb();
  const toast = useToast();
  const [at, setAt] = useState(() => new Date(log.takenAt));

  const save = () => {
    try {
      if (at.getTime() !== new Date(log.takenAt).getTime())
        updateMedicationLogTime(db, log.id, at.toISOString());
    } catch (error) {
      logger.error('updateMedicationLog', error);
      toast("We couldn't save that. Please try again.");
      return;
    }
    toast('Changes saved');
    onSaved();
  };

  return (
    <View>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>
        Edit {log.name}
      </AppText>
      <TimeField label="Taken" value={at} onChange={setAt} />
      <View style={styles.actions}>
        <Button label="Save" onPress={save} />
        <Button label="Cancel" variant="quietDanger" onPress={onCancel} />
      </View>
    </View>
  );
}

/** False once unmounted, so a re-check that finishes after the sheet closed doesn't touch state. */
function useAlive() {
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  return alive;
}

const styles = StyleSheet.create({
  title: { marginBottom: space.s2 },
  actions: { marginTop: space.s1, gap: space.s1 },
});
