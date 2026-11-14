import { router, useFocusEffect } from 'expo-router';
import { Gift, Pencil, Settings, User } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { tabBarClearance } from '@/components/FloatingTabBar';
import { AvatarSheet } from '@/components/profile/AvatarSheet';
import { NameSheet } from '@/components/profile/NameSheet';
import { ProfileLinkRow } from '@/components/profile/ProfileLinkRow';
import { Screen } from '@/components/Screen';
import { TopBarButton } from '@/components/TopBar';
import { useDb, useSettings } from '@/db/DatabaseProvider';
import { listCheckIns } from '@/db/repositories/checkIns';
import { ownedCount } from '@/lib/bellieItems';
import { summarizeCheckIns } from '@/lib/streak';
import { currentTimeZone } from '@/lib/time';
import { radius, space, useColors } from '@/theme';

type Sheet = 'avatar' | 'name' | null;

/**
 * You: who you are, then two rows (Figma G6a): About you, which holds the six lists, and Customize Bellie, the gifts.
 * A tab on the bottom bar, with a gear at the top right that opens Settings (Figma row 29g).
 */
export default function ProfileScreen() {
  const colors = useColors();
  const { settings } = useSettings();
  const db = useDb();
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<Sheet>(null);
  // Bumped on every open, so each sheet starts fresh from the saved values (see the sheets' `key` note).
  const [opened, setOpened] = useState(0);
  const open = (next: Exclude<Sheet, null>) => {
    setOpened((count) => count + 1);
    setSheet(next);
  };
  const close = () => setSheet(null);
  const named = settings.userName.length > 0;
  // Read again each time the tab comes into view: the tab stays mounted, so a check-in made since would not show.
  const [gifts, setGifts] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setGifts(ownedCount(summarizeCheckIns(listCheckIns(db), new Date(), currentTimeZone()).checkInDays));
    }, [db]),
  );

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance(insets.bottom) }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <AppText variant="display" accessibilityRole="header" style={styles.title}>
            Profile
          </AppText>
          <TopBarButton icon={Settings} label="Settings" onPress={() => router.push('/settings')} />
        </View>

        <View style={styles.identity}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change avatar"
            onPress={() => open('avatar')}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
            <Avatar name={settings.userName} avatar={settings.avatar} size="large" />
            <View style={[styles.badge, { backgroundColor: colors.surface }]}>
              <Pencil size={16} color={colors.ink} strokeWidth={2} />
            </View>
          </Pressable>
          {/* The name is the way to edit it, so there is no separate button. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={named ? 'Edit name' : 'Add your name'}
            accessibilityValue={named ? { text: settings.userName } : undefined}
            onPress={() => open('name')}
            hitSlop={{ top: 6, bottom: 6, left: 16, right: 16 }}
            style={({ pressed }) => [styles.name, { opacity: pressed ? 0.85 : 1 }]}>
            <AppText variant="display" color={named ? 'ink' : 'inkSoft'}>
              {named ? settings.userName : 'Add your name'}
            </AppText>
          </Pressable>
        </View>

        <View style={styles.links}>
          <ProfileLinkRow
            icon={User}
            tone="lavender"
            title="About you"
            subtitle="What Bellie knows about you"
            onPress={() => router.push('/about-you')}
          />
          <ProfileLinkRow
            icon={Gift}
            tone="honey"
            title="Customize Bellie"
            subtitle={
              gifts === 0 ? 'Gifts come with check-ins' : `${gifts} ${gifts === 1 ? 'gift' : 'gifts'} so far`
            }
            onPress={() => router.push('/bellies-things')}
          />
        </View>
      </ScrollView>

      <AvatarSheet key={`avatar-${opened}`} visible={sheet === 'avatar'} onClose={close} />
      <NameSheet key={`name-${opened}`} visible={sheet === 'name'} onClose={close} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.s2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.s2, marginBottom: space.s4 },
  title: { flex: 1 },
  links: { gap: space.s2 },
  identity: { alignItems: 'center', marginBottom: space.s4 },
  name: { marginTop: space.s1 },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
