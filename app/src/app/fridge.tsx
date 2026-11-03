import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { FoodLoading } from '@/components/FoodLoading';
import { Screen } from '@/components/Screen';
import { useDb } from '@/db/DatabaseProvider';
import {
  addToFridge,
  fridgeUpdatedAt,
  listFridgeItems,
  removeFridgeItem,
} from '@/db/repositories/fridgeItems';
import type { FridgeItem } from '@/db/schema';
import { AppError, type ErrorCode, friendlyMessages } from '@/lib/errors';
import { thingsLine, updatedLine } from '@/lib/fridge';
import { fridgeErrorMessage } from '@/lib/kitchenCopy';
import { logger } from '@/lib/logger';
import { type PhotoSource, pickFoodPhoto } from '@/services/photoPicker';
import { scanFridge } from '@/services/relayClient';
import { cardEdge, minTouchTarget, radius, space, useColors } from '@/theme';

const MAX_PHOTOS = 3;
const PRIVACY = 'Photos are only used to find ingredients.';
const CAMERA_DENIED = 'Camera access is off. You can turn it on in Settings, or choose from your photos.';

type Photo = { uri: string };

function load(db: ReturnType<typeof useDb>): { items: FridgeItem[]; updated: string | null } {
  try {
    return { items: listFridgeItems(db), updated: fridgeUpdatedAt(db) };
  } catch (error) {
    logger.error('loadFridge', error);
    return { items: [], updated: null };
  }
}

/**
 * My fridge (Kitchen, Figma row 29f, 29n, 29m, 29o): what Bellie found in your fridge photos, kept on the phone as
 * a list you can trim. With nothing saved it asks for one to three photos; "Add more photos" does the same later,
 * and what it finds joins the list (a name already there is skipped). "Done" goes back to the Kitchen.
 * The photos are read once and not kept, and a scan that fails leaves the old list as it was. The Kitchen's
 * "Use my fridge" switch and the have/need ticks on a recipe read this list.
 */
export default function FridgeScreen() {
  const db = useDb();
  const colors = useColors();
  const [{ items, updated }, setSaved] = useState(() => load(db));
  // With a list we start on it; with none we start by asking for photos.
  const [picking, setPicking] = useState(items.length === 0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [scanning, setScanning] = useState(false);
  const [failure, setFailure] = useState<ErrorCode | 'EMPTY' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const running = useRef<AbortController | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      running.current?.abort();
    };
  }, []);

  const reload = () => setSaved(load(db));

  const addPhoto = async (source: PhotoSource) => {
    if (scanning || photos.length >= MAX_PHOTOS) return;
    setNotice(null);
    try {
      const picked = await pickFoodPhoto(source);
      if (!alive.current) return;
      if (picked.status === 'denied') setNotice(CAMERA_DENIED);
      if (picked.status !== 'ok') return;
      setPhotos((current) => [...current, { uri: picked.photo.uri }].slice(0, MAX_PHOTOS));
      setFailure(null);
    } catch (error) {
      logger.error('pickFridgePhoto', error);
      if (alive.current) setNotice(friendlyMessages.INTERNAL);
    }
  };
  const choosePhoto = () =>
    Alert.alert('Add a photo', undefined, [
      { text: 'Take a photo', onPress: () => void addPhoto('camera') },
      { text: 'Choose from photos', onPress: () => void addPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  const dropPhoto = (index: number) => {
    if (scanning) return;
    setPhotos((current) => current.filter((_, at) => at !== index));
  };

  const find = async () => {
    if (scanning || photos.length === 0) return;
    const controller = new AbortController();
    running.current = controller;
    setScanning(true);
    setFailure(null);
    try {
      const names = await scanFridge(
        photos.map((photo) => photo.uri),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      // Nothing edible made out: the old list stays and the screen says so.
      if (names.length === 0 || addToFridge(db, names) === 0) {
        setFailure('EMPTY');
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setPhotos([]);
      reload();
      setPicking(false);
    } catch (error) {
      if (controller.signal.aborted) return;
      logger.error('scanFridge', error);
      setFailure(error instanceof AppError ? error.code : 'INTERNAL');
    } finally {
      if (alive.current) setScanning(false);
    }
  };

  const remove = (item: FridgeItem) => {
    try {
      removeFridgeItem(db, item.id);
    } catch (error) {
      logger.error('removeFridgeItem', error);
      Alert.alert("Couldn't remove", friendlyMessages.INTERNAL);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    const next = load(db);
    setSaved(next);
    if (next.items.length === 0) setPicking(true);
  };

  const addMore = () => {
    setPhotos([]);
    setFailure(null);
    setNotice(null);
    setPicking(true);
  };
  const back = () => {
    running.current?.abort();
    if (picking && items.length > 0) {
      setPicking(false);
      setFailure(null);
      return;
    }
    router.back();
  };

  return (
    <Screen style={styles.screen}>
      <BackHeader onBack={back} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heading}>
          <AppText variant="display" accessibilityRole="header">
            My fridge
          </AppText>
          <AppText variant="voiceSmall" color="inkSoft">
            {picking ? 'Snap a photo or two of your shelves.' : updated ? updatedLine(updated) : ''}
          </AppText>
        </View>

        {picking ? (
          <>
            <View style={styles.tiles}>
              {photos.map((photo, index) => (
                <View key={photo.uri} style={styles.tile}>
                  <Image
                    source={{ uri: photo.uri }}
                    style={styles.thumb}
                    contentFit="cover"
                    accessibilityLabel={`Photo ${index + 1}`}
                  />
                  {!scanning && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove photo ${index + 1}`}
                      onPress={() => dropPhoto(index)}
                      hitSlop={(minTouchTarget - 28) / 2}
                      style={[styles.dropPhoto, { backgroundColor: colors.surface }]}>
                      <X size={16} color={colors.ink} strokeWidth={2} />
                    </Pressable>
                  )}
                </View>
              ))}
              {photos.length < MAX_PHOTOS && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add a photo"
                  disabled={scanning}
                  onPress={choosePhoto}
                  style={[styles.tile, styles.add, { backgroundColor: colors.sageTint }]}>
                  <Plus size={28} color={colors.sageInk} strokeWidth={2} />
                </Pressable>
              )}
            </View>
            <AppText variant="caption" color="inkMuted">
              {PRIVACY}
            </AppText>
            {notice ? (
              <AppText variant="caption" color="inkSoft" accessibilityLiveRegion="polite">
                {notice}
              </AppText>
            ) : null}

            {scanning ? (
              <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
                <FoodLoading source="fridge" />
                <AppText variant="caption" color="inkMuted" style={styles.center}>
                  This usually takes about 10 seconds.
                </AppText>
              </View>
            ) : failure ? (
              <View
                accessibilityLiveRegion="polite"
                style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
                <AppText variant="voiceSmall" style={styles.center}>
                  Couldn&apos;t read the photos
                </AppText>
                <AppText variant="caption" color="inkSoft" style={styles.center}>
                  {fridgeErrorMessage(failure)}
                </AppText>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <AppText variant="section" accessibilityRole="header">
              {`Bellie found ${thingsLine(items.length)}`}
            </AppText>
            <View style={styles.chips}>
              {items.map((item) => (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.name}`}
                  onPress={() => remove(item)}
                  style={[styles.chip, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
                  <AppText>{item.name}</AppText>
                  <X size={14} color={colors.inkSoft} strokeWidth={2.5} />
                </Pressable>
              ))}
            </View>
            <AppText variant="caption" color="inkMuted">
              Not quite right? Tap × to remove.
            </AppText>
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {!picking && (
          <AppText variant="caption" color="inkMuted">
            {PRIVACY}
          </AppText>
        )}
        {picking ? (
          <Button
            label={failure ? 'Try again' : scanning ? 'Looking…' : 'Find ingredients'}
            disabled={scanning || photos.length === 0}
            onPress={() => void find()}
          />
        ) : (
          <>
            <Button label="Done" onPress={() => router.back()} />
            <Button label="Add more photos" variant="secondary" onPress={addMore} />
          </>
        )}
      </View>
    </Screen>
  );
}

const TILE = 108;

const styles = StyleSheet.create({
  screen: { paddingBottom: 0 },
  content: { gap: space.s2, paddingBottom: space.s3 },
  heading: { gap: space.s1, marginBottom: space.s1 },
  tiles: { flexDirection: 'row', gap: space.s1_5 },
  tile: { width: TILE, height: TILE, borderRadius: radius.lg, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  add: { alignItems: 'center', justifyContent: 'center' },
  dropPhoto: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { borderRadius: radius.lg, padding: space.s2, gap: space.s1 },
  center: { textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1 },
  chip: {
    minHeight: minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingHorizontal: space.s2,
    borderRadius: radius.pill,
  },
  footer: { gap: space.s1, paddingTop: space.s2 },
});
