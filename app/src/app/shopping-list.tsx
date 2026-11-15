import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, type ScrollViewInstance, Share, StyleSheet, View } from 'react-native';

import { AddRow } from '@/components/AddRow';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { TickRow } from '@/components/kitchen/TickRow';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { TopBarButton } from '@/components/TopBar';
import { useDb } from '@/db/DatabaseProvider';
import { fridgeUpdatedAt, listFridgeItems } from '@/db/repositories/fridgeItems';
import { getCurrentPlan } from '@/db/repositories/mealPlans';
import { addOwnItem, getPlanChecks, setChecked } from '@/db/repositories/planChecks';
import { daysSince, fridgeIsStale } from '@/lib/fridge';
import { todayKey } from '@/lib/kitchen';
import { logger } from '@/lib/logger';
import { buildShoppingList, shoppingSummary, shoppingText } from '@/lib/shopping';
import { cardEdge, radius, space, useColors } from '@/theme';

/**
 * The shopping list of the plan (Figma "meal planning flow" E3): what the week needs that the fridge and the pantry
 * do not cover, by aisle, ticked off in the shop. What is already at home is one tap away, a stale fridge scan gets
 * a nudge to scan again, and the list can be added to by hand and shared as text.
 */
export default function ShoppingListScreen() {
  const db = useDb();
  const colors = useColors();
  const plan = useMemo(() => getCurrentPlan(db), [db]);
  const [checks, setChecks] = useState(() =>
    plan ? getPlanChecks(db, plan.id) : { prep: new Set<string>(), shop: new Set<string>(), own: [] },
  );
  const [adding, setAdding] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const [draft, setDraft] = useState('');
  const [haveOpen, setHaveOpen] = useState(false);
  // Bumped when the screen comes back into view (after scanning the fridge), so the list is worked out again.
  const [, setSeen] = useState(0);
  useFocusEffect(useCallback(() => setSeen((n) => n + 1), []));
  // Opening the field brings the end of the list into view, once the keyboard has slid up.
  useEffect(() => {
    if (!adding) return;
    const timer = setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 300);
    return () => clearTimeout(timer);
  }, [adding]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // Worked out on every render (a few reads and some adding): coming back from the fridge re-renders it.
  const scannedAt = fridgeUpdatedAt(db);
  const fridge = plan?.choices.useFridge ? listFridgeItems(db).map((item) => item.name) : [];
  const list = plan ? buildShoppingList(plan.meals, fridge, checks.own, todayKey()) : null;

  if (!plan || !list) {
    return (
      <Screen>
        <View style={styles.headerRow}>
          <TopBarButton icon={ChevronLeft} label="Back" onPress={goBack} />
        </View>
        <AppText variant="display" accessibilityRole="header">
          Shopping list
        </AppText>
        <AppText color="inkSoft" style={styles.empty}>
          There is no plan yet. Make one from the Kitchen.
        </AppText>
      </Screen>
    );
  }

  const toggle = (key: string) => {
    const next = !checks.shop.has(key);
    try {
      setChecked(db, plan.id, 'shop', key, next);
      setChecks(getPlanChecks(db, plan.id));
      Haptics.selectionAsync().catch(() => {});
    } catch (error) {
      logger.error('tickShoppingItem', error);
    }
  };

  const add = () => {
    try {
      addOwnItem(db, plan.id, draft);
      setChecks(getPlanChecks(db, plan.id));
    } catch (error) {
      logger.error('addShoppingItem', error);
    }
    setDraft('');
    setAdding(false);
  };

  const share = () => {
    const message = shoppingText(list, checks.shop);
    if (!message) return;
    Share.share({ message }).catch((error) => logger.error('shareShoppingList', error));
  };

  const stale = scannedAt !== null && plan.choices.useFridge && fridgeIsStale(scannedAt);

  return (
    <Screen>
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        // iOS lifts the content above the keyboard; the effect above scrolls the field into view.
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <TopBarButton icon={ChevronLeft} label="Back" onPress={goBack} />
          <View style={styles.titleBlock}>
            <AppText variant="display" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
              Shopping list
            </AppText>
            <AppText variant="voiceSmall" color="inkSoft">
              {shoppingSummary(list)}
            </AppText>
          </View>
        </View>

        {stale && scannedAt && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Your fridge was scanned ${daysSince(scannedAt)} days ago. Scan it again.`}
            onPress={() => router.push('/fridge')}
            style={[styles.nudge, { backgroundColor: colors.honeyTint }]}>
            <AppText style={styles.fill} color="inkSoft">
              Your fridge was scanned {daysSince(scannedAt)} days ago. Scan it again to see what you still
              need.
            </AppText>
            <ChevronRight size={20} color={colors.honeyInk} strokeWidth={2} />
          </Pressable>
        )}

        {list.aisles.length === 0 && <AppText color="inkSoft">You have everything this plan needs.</AppText>}

        {list.aisles.map((aisle) => (
          <View key={aisle.name} style={styles.aisle}>
            <AppText variant="bodyEm" color="inkMuted" accessibilityRole="header">
              {aisle.name}
            </AppText>
            <View style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
              {aisle.items.map((item, index) => (
                <TickRow
                  key={item.key}
                  label={item.name}
                  trailing={item.amount}
                  checked={checks.shop.has(item.key)}
                  shape="box"
                  divider={index > 0}
                  onToggle={() => toggle(item.key)}
                />
              ))}
            </View>
          </View>
        ))}

        {list.have.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`You already have, ${list.have.length} items, from your fridge and pantry`}
            onPress={() => setHaveOpen(true)}
            style={[styles.have, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
            <View style={styles.fill}>
              <AppText variant="bodyEm">You already have</AppText>
              <AppText variant="caption" color="inkMuted">
                {list.have.length} items, from your fridge and pantry
              </AppText>
            </View>
            <ChevronRight size={20} color={colors.inkMuted} strokeWidth={2} />
          </Pressable>
        )}
        {/* At the very bottom, after the aisles. The scroll view makes room for the keyboard and scrolls here. */}
        {adding ? (
          <TextField
            label="Add an item"
            hideLabel
            placeholder="Add an item"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            returnKeyType="done"
            autoFocus
            card
          />
        ) : (
          <AddRow label="Add an item" onPress={() => setAdding(true)} />
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.bg }]}>
        <Button label="Share list" variant="secondary" onPress={share} disabled={list.toBuy === 0} />
      </View>

      <BottomSheet visible={haveOpen} onClose={() => setHaveOpen(false)} tone="bg">
        <AppText variant="displaySmall" accessibilityRole="header">
          You already have
        </AppText>
        <View
          style={[styles.card, styles.haveList, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
          {list.have.map((name) => (
            <AppText key={name} style={styles.haveItem}>
              {name}
            </AppText>
          ))}
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: space.s2, marginBottom: space.s1 },
  titleBlock: { flex: 1, gap: 4 },
  content: { gap: space.s3, paddingBottom: space.s3 },
  empty: { marginTop: space.s1 },
  aisle: { gap: space.s1 },
  card: { borderRadius: radius.lg, paddingHorizontal: space.s2, paddingVertical: space.s1 },
  nudge: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1_5,
    borderRadius: radius.md,
    padding: space.s2,
  },
  have: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1_5,
    borderRadius: radius.md,
    paddingHorizontal: space.s2,
    paddingVertical: space.s1_5,
  },
  haveList: { marginTop: space.s2, marginBottom: space.s2 },
  haveItem: { paddingVertical: space.s1 },
  fill: { flex: 1 },
  footer: { paddingTop: space.s1, paddingBottom: space.s3 },
});
