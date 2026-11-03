import { Asset } from 'expo-asset';
import { requireOptionalNativeModule } from 'expo';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { getSetting, setSetting } from '@/db/repositories/settings';
import { listSavedFoods } from '@/db/repositories/savedFoods';
import type { AppDb } from '@/db/types';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { newWidgetToken, pickWidgetFoods } from '@/lib/widgetLinks';

const ART = require('@/assets/images/widget-bellie-says.png');

type FoodWidgetModule = typeof import('@/widgets/FoodWidget');
type WidgetsModule = typeof import('expo-widgets');

/** The token a one-tap log link must carry; made once, the first time the widget is filled. */
export function ensureWidgetToken(db: AppDb): string {
  const stored = getSetting(db, 'widgetToken');
  if (stored) return stored;
  const token = newWidgetToken();
  setSetting(db, 'widgetToken', token);
  return token;
}

// The picture is copied into the widgets folder once per launch (the widget can only read files from there).
let art: Promise<string | null> | null = null;

function copyArt(directory: string): Promise<string | null> {
  art ??= (async () => {
    const asset = Asset.fromModule(ART);
    await asset.downloadAsync();
    if (!asset.localUri) return null;
    const destination = new File(directory, 'bellie-says.png');
    if (destination.exists) destination.delete();
    new File(asset.localUri).copy(destination);
    return destination.uri;
  })().catch((error: unknown) => {
    art = null; // try again next time
    throw error;
  });
  return art;
}

/**
 * Gives the home-screen widget what it shows: Bellie's picture and the first few saved foods. Called when the
 * app opens and whenever Favorite foods changes. It does nothing off iOS, and in Expo Go (which has no widget module),
 * where the app simply carries on; a development build is needed to see the widget.
 */
export async function syncWidget(db: AppDb): Promise<void> {
  if (Platform.OS !== 'ios') return;
  // Expo Go has no widget module. Asking first matters: requiring the package there throws, and a bundler in
  // development reports a failed require outside start-up as a fatal error before the catch below can see it.
  if (!requireOptionalNativeModule('ExpoWidgets')) return;
  let widgets: WidgetsModule;
  let FoodWidget: FoodWidgetModule['default'];
  try {
    // Loaded only here, so a build without the native widget module (Expo Go) never fails at start-up.
    /* eslint-disable @typescript-eslint/no-require-imports */
    widgets = require('expo-widgets') as WidgetsModule;
    FoodWidget = (require('@/widgets/FoodWidget') as FoodWidgetModule).default;
    /* eslint-enable @typescript-eslint/no-require-imports */
  } catch {
    return; // Expo Go: no native widget module here
  }
  if (!widgets.widgetsDirectory) return; // no App Group configured
  try {
    FoodWidget.updateSnapshot({
      art: await copyArt(widgets.widgetsDirectory),
      foods: pickWidgetFoods(listSavedFoods(db)),
      token: ensureWidgetToken(db),
    });
  } catch {
    // Code only: a raw error could carry a file path or a food name.
    logger.error('syncWidget', new AppError('INTERNAL'));
  }
}
