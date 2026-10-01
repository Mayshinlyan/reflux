import { type Href, Redirect, router } from 'expo-router';
import { Activity, Camera, Carrot, Pill, Plus, UserRound } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { CircleActionButton } from '@/components/CircleActionButton';
import { CoinCounter } from '@/components/CoinCounter';
import { Pet } from '@/components/Pet';
import { Screen } from '@/components/Screen';
import { SwipeNav } from '@/components/SwipeNav';
import { useSettings } from '@/db/DatabaseProvider';
import { useCoins } from '@/hooks/useCoins';
import { usePetState } from '@/hooks/usePetState';
import { PET_ASPECT } from '@/lib/petClips';
import { STAGE_SCALE, statusLine } from '@/lib/petProgress';
import { PETS } from '@/lib/pets';
import { fontFamily, radius, space, useColors } from '@/theme';

/**
 * Everything on Today that isn't the pet, stacked vertically: screen padding, the header,
 * the name/status/progress block and the Log/Scan row. The pet gets the rest.
 */
const RESERVED_HEIGHT = 330;

/** The pet takes this share of the room it could fill; the full width felt too big on device. */
const PET_FILL = 0.7;

/**
 * The full-size (Grown dog) pet: PET_FILL of what the screen allows, and short enough that
 * the whole screen fits on small phones too. Younger stages draw at STAGE_SCALE of it.
 */
function usePetSize() {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const byWidth = window.width - 2 * space.s3;
  const byHeight = (window.height - insets.top - insets.bottom - RESERVED_HEIGHT) / PET_ASPECT;
  const width = Math.floor(Math.max(160, PET_FILL * Math.min(byWidth, byHeight)));
  // Pet's own layout: clip height plus its ground-shadow gap.
  return { width, height: Math.round(width * PET_ASPECT) + space.s2 };
}

/**
 * Today — the pet-hero home screen, laid out as in docs/design/mockups.html.
 * "Log" opens a floating menu above the pet; "Scan" opens Check. Tapping the pet plays
 * with it (see Pet). The pet's stage, progress and mood are derived from the logs
 * (lib/petProgress). Every log earns a coin, shown top right (lib/coins). Swiping left opens Your Logs;
 * swiping right opens the profile (Settings).
 * First launch redirects to Welcome.
 */
export default function TodayScreen() {
  const colors = useColors();
  const [menuOpen, setMenuOpen] = useState(false);
  const { settings } = useSettings();
  const petName = settings.petName;
  const animal = settings.petAnimal;
  const pet = usePetState();
  const coins = useCoins();
  const petSize = usePetSize();

  const go = (href: Href) => {
    setMenuOpen(false);
    router.push(href);
  };

  // Stable, so a re-render (the pet animates) doesn't rebuild the swipe gesture mid-drag.
  const swipeToLogs = useCallback(() => go('/history'), []);
  const swipeToProfile = useCallback(() => go('/settings'), []);

  if (!settings.onboardingDone) return <Redirect href="/welcome" />;

  return (
    <SwipeNav onSwipeLeft={swipeToLogs} onSwipeRight={swipeToProfile}>
      <Screen style={styles.container}>
        <View style={styles.header}>
          <CoinCounter coins={coins.coins} gain={coins.gain} gainId={coins.gainId} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => go('/settings')}
            style={[styles.iconButton, { backgroundColor: colors.surface2 }]}>
            <UserRound size={19} color={colors.ink} strokeWidth={2} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <View style={styles.stageWrap}>
            <View style={[styles.petBox, petSize]}>
              <Pet
                name={petName}
                animal={animal}
                width={Math.round(petSize.width * STAGE_SCALE[pet.stage])}
                mood={pet.mood}
                celebrating={pet.stageUp}
                onCelebrationEnd={pet.markStageSeen}
              />
            </View>
          </View>
          {/* While the Log menu is open it sits over this block, so the block steps aside. */}
          <View
            style={[styles.info, menuOpen && styles.hidden]}
            accessibilityElementsHidden={menuOpen}
            importantForAccessibility={menuOpen ? 'no-hide-descendants' : 'auto'}>
            <AppText style={styles.petName}>{petName}</AppText>
            <AppText variant="label" color={pet.mood === 'happy' ? 'sageInk' : 'clayInk'}>
              {statusLine(petName, pet.mood, pet.hasLogs, animal)}
            </AppText>
            <View
              style={[styles.track, { backgroundColor: colors.surface2 }]}
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`${PETS[animal].stageNames[pet.stage]}, growth progress`}
              accessibilityValue={{ min: 0, max: 100, now: pet.progress }}>
              <View style={[styles.fill, { width: `${pet.progress}%`, backgroundColor: colors.sage }]} />
            </View>
            <AppText variant="caption" color="inkSoft">
              {PETS[animal].stageNames[pet.stage]}
            </AppText>
          </View>
          {menuOpen && (
            <View style={styles.menu}>
              <CircleActionButton
                variant="menu"
                label="Symptoms"
                icon={Activity}
                onPress={() => go('/log/symptoms')}
              />
              <View style={styles.menuRaised}>
                <CircleActionButton
                  variant="menu"
                  label="Food"
                  icon={Carrot}
                  onPress={() => go('/log/food')}
                />
              </View>
              <CircleActionButton
                variant="menu"
                label="Medication"
                icon={Pill}
                onPress={() => go('/log/medication')}
              />
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <CircleActionButton
            variant="primary"
            label="Log"
            icon={Plus}
            accessibilityHint="Choose symptoms, food or medication"
            onPress={() => setMenuOpen((open) => !open)}
          />
          <CircleActionButton
            label="Scan"
            icon={Camera}
            accessibilityHint="Opens the camera to check a food"
            onPress={() => go({ pathname: '/log/food', params: { camera: '1' } })}
          />
        </View>
      </Screen>
    </SwipeNav>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingBottom: space.s4 },
  header: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end', gap: space.s1 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  petBox: { alignItems: 'center', justifyContent: 'flex-end' },
  info: { alignItems: 'center' },
  hidden: { opacity: 0 },
  track: { width: 200, height: 8, borderRadius: radius.pill, marginTop: space.s1, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  stageWrap: { alignItems: 'center', justifyContent: 'center' },
  menu: {
    position: 'absolute',
    // Opens just above the Log button, over the name and progress, so the pet (which fills
    // most of the screen) keeps its face uncovered.
    bottom: 0,
    width: 260,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: space.s3,
  },
  menuRaised: { marginBottom: 14 },
  petName: { fontSize: 19, lineHeight: 24, fontFamily: fontFamily.extrabold, marginTop: space.s1 },
  actions: { flexDirection: 'row', gap: 28, paddingTop: 28 },
});
