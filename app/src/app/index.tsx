import { Image } from 'expo-image';
import { type Href, router } from 'expo-router';
import { Activity, Camera, Pill, Plus, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CircleActionButton } from '@/components/CircleActionButton';
import { Screen } from '@/components/Screen';
import { fontFamily, radius, space, useColors } from '@/theme';

const PET_SIZE = 200;
const DOG_IMAGE = require('@/assets/images/pet/dog.png');
/** dog.png is 276×298; keep its aspect ratio. */
const PET_HEIGHT = Math.round((PET_SIZE * 298) / 276);

/**
 * Today — the pet-hero home screen, laid out as in docs/design/mockups.html.
 * "Log" opens a floating menu over the pet; "Scan" opens Check. The pet is a static
 * image until Step 6 adds stages, moods and animation; Step 2 adds the redirect to
 * /welcome on first launch.
 */
export default function TodayScreen() {
  const colors = useColors();
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (href: Href) => {
    setMenuOpen(false);
    router.push(href);
  };

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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Buddy. Add an entry"
            onPress={() => setMenuOpen((open) => !open)}>
            <Image source={DOG_IMAGE} style={styles.pet} contentFit="contain" accessible={false} />
          </Pressable>
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
                  icon={Camera}
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
        <AppText style={styles.petName}>Buddy</AppText>
        <AppText variant="label" color="sageInk">
          Buddy is happy to see you!
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
  stageWrap: { alignItems: 'center', justifyContent: 'center' },
  pet: { width: PET_SIZE, height: PET_HEIGHT },
  menu: {
    position: 'absolute',
    bottom: PET_SIZE * 0.35,
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
