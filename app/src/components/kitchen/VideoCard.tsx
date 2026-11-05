import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { Play } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { logger } from '@/lib/logger';
import { videoUrl } from '@/lib/recipe';
import { cardEdge, radius, space, useColors } from '@/theme';

const LABEL = 'Watch similar recipe on YouTube';

/**
 * The first card of a recipe's steps when a video of a similar recipe was found (Figma row 29e4d): a play tile, "Video"
 * and the line "Watch similar recipe on YouTube". Tapping it opens the video in the in-app browser. There is no
 * thumbnail on purpose, so nothing is fetched from YouTube until the person taps. Same shape as `StepCard`.
 */
export function VideoCard({ videoId }: { videoId: string }) {
  const colors = useColors();
  const open = () => {
    Haptics.selectionAsync().catch(() => {});
    WebBrowser.openBrowserAsync(videoUrl(videoId)).catch((error) => logger.error('openRecipeVideo', error));
  };
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${LABEL}, opens YouTube`}
      onPress={open}
      style={[styles.card, { backgroundColor: colors.surface, ...cardEdge(colors) }]}>
      <View style={[styles.tile, { backgroundColor: colors.honeyTint }]}>
        <Play size={28} color={colors.honeyInk} fill={colors.honeyInk} strokeWidth={2} />
      </View>
      <AppText variant="label" color="inkMuted">
        Video
      </AppText>
      <AppText variant="lead">{LABEL}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: radius.lg, padding: space.s2 + 4, gap: space.s1 + 4 },
  tile: { width: 56, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
