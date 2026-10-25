import { router } from 'expo-router';
import { Activity, Pencil, Pill, Utensils } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { Avatar } from '@/components/Avatar';
import { tabBarClearance } from '@/components/FloatingTabBar';
import { AvatarSheet } from '@/components/profile/AvatarSheet';
import { ConditionSheet } from '@/components/profile/ConditionSheet';
import { NameSheet } from '@/components/profile/NameSheet';
import { SymptomsSheet } from '@/components/profile/SymptomsSheet';
import { Screen } from '@/components/Screen';
import { SectionTitle } from '@/components/SectionTitle';
import { SettingsRow } from '@/components/SettingsRow';
import { SymptomChip } from '@/components/SymptomChip';
import { symptomLabel } from '@/components/SymptomZones';
import { conditionLabels, managingLine } from '@/constants/conditions';
import { useSettings } from '@/db/DatabaseProvider';
import { cardEdge, radius, space, useColors } from '@/theme';

type Sheet = 'avatar' | 'name' | 'condition' | 'symptoms' | null;

/** You: who you are, what you're managing and your lists (Figma 06). A tab on the bottom bar. */
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
  const conditionLabel = conditionLabels(settings.conditions);
  const named = settings.userName.length > 0;

  return (
    <Screen edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tabBarClearance(insets.bottom) }]}
        showsVerticalScrollIndicator={false}>
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
          <AppText
            variant="display"
            accessibilityRole="header"
            color={named ? 'ink' : 'inkSoft'}
            style={styles.name}>
            {named ? settings.userName : 'Your name'}
          </AppText>
          <AppText variant="caption" color="inkSoft">
            {managingLine(settings.conditions)}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={named ? 'Edit name' : 'Add your name'}
            onPress={() => open('name')}
            hitSlop={{ top: 6, bottom: 6 }}
            style={({ pressed }) => [
              styles.pill,
              { backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 },
            ]}>
            <Pencil size={16} color={colors.ink} strokeWidth={2} />
            <AppText variant="label">{named ? 'Edit name' : 'Add your name'}</AppText>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Condition, ${conditionLabel}, change`}
          onPress={() => open('condition')}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.surface,
              ...cardEdge(colors),
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <AppText variant="section">Condition</AppText>
          <View style={styles.conditionRow}>
            <AppText variant="bodyEm" style={styles.conditionText}>
              {conditionLabel}
            </AppText>
            <AppText color="inkSoft">Change</AppText>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Usual symptoms, change"
          onPress={() => open('symptoms')}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.surface,
              ...cardEdge(colors),
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <AppText variant="section">Usual symptoms</AppText>
          {settings.usualSymptoms.length > 0 ? (
            <View style={styles.chips}>
              {settings.usualSymptoms.map((key) => (
                <SymptomChip key={key} label={symptomLabel(key)} selected readOnly />
              ))}
            </View>
          ) : (
            <AppText color="inkSoft" style={styles.empty}>
              Tap to pick the ones you usually feel.
            </AppText>
          )}
        </Pressable>

        <View style={styles.lists}>
          <SectionTitle first>Your lists</SectionTitle>
        </View>
        <SettingsRow
          icon={Utensils}
          label="Favorite foods"
          onPress={() => router.push({ pathname: '/log/food', params: { manage: '1' } })}
        />
        <SettingsRow
          icon={Pill}
          label="Medications"
          onPress={() => router.push({ pathname: '/log/medication', params: { manage: '1' } })}
        />
        <SettingsRow
          icon={Activity}
          label="Symptoms and lifestyles"
          onPress={() => router.push('/my-additions')}
        />
      </ScrollView>

      <AvatarSheet key={`avatar-${opened}`} visible={sheet === 'avatar'} onClose={close} />
      <NameSheet key={`name-${opened}`} visible={sheet === 'name'} onClose={close} />
      <ConditionSheet key={`condition-${opened}`} visible={sheet === 'condition'} onClose={close} />
      <SymptomsSheet key={`symptoms-${opened}`} visible={sheet === 'symptoms'} onClose={close} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.s2 },
  // The card above leaves 16, so this adds 16 for the 32 between groups.
  lists: { marginTop: space.s2 },
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
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: space.s2,
    paddingLeft: 14,
    paddingRight: 16,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  card: { borderRadius: radius.lg, padding: space.s2, marginBottom: space.s2 },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.s1,
  },
  conditionText: { flex: 1, marginRight: space.s1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s1, marginTop: space.s1 },
  empty: { marginTop: space.s1 },
});
