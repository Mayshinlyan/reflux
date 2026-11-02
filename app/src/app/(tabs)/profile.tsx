import { router } from 'expo-router';
import { Ban, Leaf, Pencil, Pill, Settings, Stethoscope, Thermometer, Utensils } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { tabBarClearance } from '@/components/FloatingTabBar';
import { AvatarSheet } from '@/components/profile/AvatarSheet';
import { ConditionSheet } from '@/components/profile/ConditionSheet';
import { NameSheet } from '@/components/profile/NameSheet';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { SettingsRow } from '@/components/SettingsRow';
import { TopBarButton } from '@/components/TopBar';
import { useSettings } from '@/db/DatabaseProvider';
import { radius, space, useColors } from '@/theme';

type Sheet = 'avatar' | 'name' | 'condition' | null;

/**
 * You: who you are and your lists (Figma row 24). A tab on the bottom bar, with a gear at the top right that opens
 * Settings (Figma row 29g). Condition is a sheet; Usual symptoms, Favorite foods, Medications and Lifestyle are pages.
 */
export default function ProfileScreen() {
  const colors = useColors();
  const { settings } = useSettings();
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

        <SectionTitle first>Your lists</SectionTitle>
        <SettingsRow icon={Stethoscope} label="Condition" onPress={() => open('condition')} />
        <SettingsRow
          icon={Thermometer}
          label="Usual symptoms"
          onPress={() => router.push('/usual-symptoms')}
        />
        <SettingsRow
          icon={Utensils}
          label="Favorite foods"
          onPress={() => router.push({ pathname: '/log/food', params: { manage: '1' } })}
        />
        <SettingsRow icon={Ban} label="I don't eat" onPress={() => router.push('/avoid-foods')} />
        <SettingsRow
          icon={Pill}
          label="Medications"
          onPress={() => router.push({ pathname: '/log/medication', params: { manage: '1' } })}
        />
        <SettingsRow icon={Leaf} label="Lifestyle" onPress={() => router.push('/lifestyle')} />
      </ScrollView>

      <AvatarSheet key={`avatar-${opened}`} visible={sheet === 'avatar'} onClose={close} />
      <NameSheet key={`name-${opened}`} visible={sheet === 'name'} onClose={close} />
      <ConditionSheet key={`condition-${opened}`} visible={sheet === 'condition'} onClose={close} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.s2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.s2, marginBottom: space.s4 },
  title: { flex: 1 },
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
