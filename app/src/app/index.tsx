import { type Href, Redirect, router } from 'expo-router';
import { Activity, Camera, Carrot, Pill, Plus, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CircleActionButton } from '@/components/CircleActionButton';
import { Pet } from '@/components/Pet';
import { Screen } from '@/components/Screen';
import { useSettings } from '@/db/DatabaseProvider';
import { usePetState } from '@/hooks/usePetState';
import { PET_ASPECT } from '@/lib/petClips';
import { STAGE_NAMES, STAGE_SCALE, statusLine } from '@/lib/petProgress';
import { fontFamily, radius, space, useColors } from '@/theme';

/** Full-size (Grown dog) pet width. Younger stages draw at STAGE_SCALE of this. */
const PET_SIZE = 340;
/** Matches Pet's own layout: clip height plus its ground-shadow gap. */
const PET_HEIGHT = Math.round(PET_SIZE * PET_ASPECT) + space.s2;

/**
 * Today — the pet-hero home screen, laid out as in docs/design/mockups.html.
 * "Log" opens a floating menu above the pet; "Scan" opens Check. Tapping the pet plays
 * with it (see Pet). The pet's stage, progress and mood are derived from the logs
 * (lib/petProgress). First launch redirects to Welcome.
 */
export default function TodayScreen() {
  const colors = useColors();
  const [menuOpen, setMenuOpen] = useState(false);
  const { settings } = useSettings();
  const petName = settings.petName;
  const pet = usePetState();

  const go = (href: Href) => {
    setMenuOpen(false);
    router.push(href);
  };

  if (!settings.onboardingDone) return <Redirect href="/welcome" />;

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
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
          <View style={styles.petBox}>
            <Pet
              name={petName}
              width={Math.round(PET_SIZE * STAGE_SCALE[pet.stage])}
              mood={pet.mood}
              hasLogs={pet.hasLogs}
              celebrating={pet.stageUp}
              onCelebrationEnd={pet.markStageSeen}
            />
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
        <AppText style={styles.petName}>{petName}</AppText>
        <AppText variant="label" color={pet.mood === 'happy' ? 'sageInk' : 'clayInk'}>
          {statusLine(petName, pet.mood, pet.hasLogs)}
        </AppText>
        <View
          style={[styles.track, { backgroundColor: colors.surface2 }]}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`${STAGE_NAMES[pet.stage]}, growth progress`}
          accessibilityValue={{ min: 0, max: 100, now: pet.progress }}>
          <View style={[styles.fill, { width: `${pet.progress}%`, backgroundColor: colors.sage }]} />
        </View>
        <AppText variant="caption" color="inkSoft">
          {STAGE_NAMES[pet.stage]}
        </AppText>
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
          accessibilityHint="Check a food before you eat it"
          onPress={() => go('/check')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingBottom: space.s4 },
  header: { width: '100%', flexDirection: 'row', justifyContent: 'flex-end' },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  petBox: { width: PET_SIZE, height: PET_HEIGHT, alignItems: 'center', justifyContent: 'flex-end' },
  track: { width: 200, height: 8, borderRadius: radius.pill, marginTop: space.s1, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  stageWrap: { alignItems: 'center', justifyContent: 'center' },
  menu: {
    position: 'absolute',
    // Opens above the pet's head so it never covers the face.
    bottom: PET_HEIGHT + space.s2,
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
