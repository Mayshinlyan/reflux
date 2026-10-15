import { useCallback, useMemo, useState } from 'react';

import { type CustomTagKey, isCustomTag, type LoggedTagKey, tagKeyFromText } from '@/constants/lifestyleTags';
import {
  CUSTOM_PREFIX,
  type CustomSymptomKey,
  customSymptomLabel,
  isCustomSymptom,
  type LoggedSymptomKey,
  symptomKeyFromText,
} from '@/constants/symptomItems';
import { useDb } from '@/db/DatabaseProvider';
import { createSavedSymptom, listSavedSymptoms } from '@/db/repositories/savedSymptoms';
import type { SavedSymptom } from '@/db/schema';
import { logger } from '@/lib/logger';

/**
 * What the user typed with a "+" chip before ("My additions"), as the chips to offer next to the built-in
 * ones, plus the two ways to add more. Used by the post-meal page; the same lists as the How I feel screen.
 * `addTag` and `addSymptom` return the key to pick (the built-in one when the text names one), or null when
 * nothing usable was typed.
 */
export function useSavedAdditions() {
  const db = useDb();
  const [saved, setSaved] = useState<SavedSymptom[]>(() => {
    try {
      return listSavedSymptoms(db);
    } catch (error) {
      logger.error('listSavedSymptoms', error);
      return [];
    }
  });
  // Typed ones this page has seen that may not be saved (a save that failed), so they stay as chips to tap.
  const [seenTags, setSeenTags] = useState<CustomTagKey[]>([]);
  const [seenSymptoms, setSeenSymptoms] = useState<CustomSymptomKey[]>([]);

  const reload = useCallback(() => {
    try {
      setSaved(listSavedSymptoms(db));
    } catch (error) {
      logger.error('listSavedSymptoms', error);
    }
  }, [db]);

  const ownTagKeys = useMemo(() => {
    const keys = saved
      .filter((row) => row.kind === 'lifestyle')
      .map((row) => `${CUSTOM_PREFIX}${row.name}` as const);
    return [...keys, ...seenTags.filter((key) => !keys.includes(key))];
  }, [saved, seenTags]);

  const ownSymptomKeys = useMemo(() => {
    const keys = saved
      .filter((row) => row.kind === 'symptom')
      .map((row) => `${CUSTOM_PREFIX}${row.name}` as const);
    return [...keys, ...seenSymptoms.filter((key) => !keys.includes(key))];
  }, [saved, seenSymptoms]);

  const addTag = useCallback(
    (text: string): LoggedTagKey | null => {
      const key = tagKeyFromText(text);
      if (!key) return null;
      if (isCustomTag(key)) {
        try {
          createSavedSymptom(db, customSymptomLabel(key), 'lifestyle');
          reload();
        } catch (error) {
          // It can still be logged; it just won't be offered as a chip next time.
          logger.error('createSavedSymptom', error);
        }
        setSeenTags((current) => (current.includes(key) ? current : [...current, key]));
      }
      return key;
    },
    [db, reload],
  );

  const addSymptom = useCallback(
    (text: string): LoggedSymptomKey | null => {
      const key = symptomKeyFromText(text);
      if (!key) return null;
      if (isCustomSymptom(key)) {
        try {
          createSavedSymptom(db, customSymptomLabel(key), 'symptom', 'other');
          reload();
        } catch (error) {
          logger.error('createSavedSymptom', error);
        }
        setSeenSymptoms((current) => (current.includes(key) ? current : [...current, key]));
      }
      return key;
    },
    [db, reload],
  );

  return { ownTagKeys, ownSymptomKeys, addTag, addSymptom };
}
