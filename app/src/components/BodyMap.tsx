import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { MAP_ZONES, TORSO_IMAGE, type ZoneKey, zoneLabel } from '@/constants/bodyZones';
import { fontFamily, space, typography, useColors } from '@/theme';

import { AppText } from './AppText';

const TORSO = require('@/assets/images/body/torso.png');

/** The figure takes this share of the row; labels sit in the rest. */
const IMAGE_SHARE = 0.64;
const LABEL_LEFT = 0.66;
const BADGE = 22;

const pct = (fraction: number) => `${fraction * 100}%` as const;

type Props = {
  /** How many symptoms are chosen in each area (shown as a badge). */
  counts: Partial<Record<ZoneKey, number>>;
  onZonePress: (zone: ZoneKey) => void;
};

/**
 * A torso illustration with three tappable areas (throat, chest, tummy), each labelled at
 * the side. Tapping one opens that area's short symptom list. Chosen areas show a solid
 * outline and a count badge, so nothing has to be listed under the figure.
 */
export function BodyMap({ counts, onZonePress }: Props) {
  const colors = useColors();
  const { width: W, height: H } = TORSO_IMAGE;

  return (
    <View style={styles.row}>
      <View style={[styles.figure, { width: pct(IMAGE_SHARE), aspectRatio: W / H }]}>
        <Image source={TORSO} style={StyleSheet.absoluteFill} contentFit="contain" accessible={false} />
        {MAP_ZONES.map((zone) => {
          const count = counts[zone.key] ?? 0;
          const selected = count > 0;
          return (
            <View
              key={zone.key}
              pointerEvents="box-none"
              style={[
                styles.abs,
                {
                  left: pct(zone.x / W),
                  top: pct(zone.y / H),
                  width: pct(zone.width / W),
                  height: pct(zone.height / H),
                },
              ]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${zoneLabel(zone.key)}${selected ? `, ${count} selected` : ''}`}
                accessibilityHint="Opens the symptoms for this area"
                onPress={() => onZonePress(zone.key)}
                // Small on purpose: the chest and tummy areas are only ~10px apart.
                hitSlop={3}
                style={({ pressed }) => [
                  StyleSheet.absoluteFill,
                  styles.zone,
                  selected
                    ? { borderColor: colors.sageInk, borderWidth: 3, backgroundColor: '#FFFFFF47' }
                    : {
                        borderColor: colors.clay,
                        borderWidth: 2,
                        borderStyle: 'dashed',
                        backgroundColor: pressed ? '#F3E3DC66' : '#F3E3DC2E',
                      },
                ]}
              />
              {selected && (
                <View
                  pointerEvents="none"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={[styles.badge, { backgroundColor: colors.cta }]}>
                  <AppText style={[styles.badgeText, { color: colors.ctaInk }]}>{count}</AppText>
                </View>
              )}
            </View>
          );
        })}
      </View>

      {/* Labels and leader lines. Tapping a label opens its area too, but the zone itself is the
          accessible control, so these are hidden from screen readers to avoid reading twice. */}
      {MAP_ZONES.map((zone) => {
        const centerY = (zone.y + zone.height / 2) / H;
        const edgeX = ((zone.x + zone.width) / W) * IMAGE_SHARE;
        return (
          // The wrapper must span the row (left/right 0): its children are all absolute, so with no
          // width of its own it would be 0 wide and every percentage inside it would collapse.
          <View
            key={zone.key}
            testID={`zone-label-row-${zone.key}`}
            pointerEvents="box-none"
            style={[styles.abs, styles.fullWidth, { top: pct(centerY) }]}>
            <View
              pointerEvents="none"
              style={[
                styles.leader,
                {
                  left: pct(edgeX),
                  width: pct(Math.max(0, LABEL_LEFT - edgeX - 0.01)),
                  backgroundColor: colors.hairline,
                },
              ]}
            />
            <Pressable
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              onPress={() => onZonePress(zone.key)}
              style={[styles.label, { left: pct(LABEL_LEFT) }]}>
              <AppText style={styles.labelText}>{zoneLabel(zone.key)}</AppText>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { width: '100%', alignItems: 'flex-start' },
  figure: { position: 'relative' },
  abs: { position: 'absolute' },
  fullWidth: { left: 0, right: 0 },
  zone: { borderRadius: 26 },
  badge: {
    position: 'absolute',
    right: -BADGE / 2,
    top: -BADGE / 2,
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { ...typography.label, fontFamily: fontFamily.extrabold, fontSize: 12, lineHeight: 16 },
  leader: { position: 'absolute', height: 2, top: -1 },
  label: { position: 'absolute', right: 0, marginTop: -space.s2, minHeight: 32, justifyContent: 'center' },
  labelText: { ...typography.bodyEm, fontSize: 15, lineHeight: 20, fontFamily: fontFamily.bold },
});
