import { HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  aspectRatio,
  background,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  padding,
  resizable,
  shapes,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type FoodWidgetProps = {
  /** `file://` path of the "Bellie says: Snap food!" picture the app copied into the widgets folder. */
  art: string | null;
  /** The saved foods to show on the medium widget, in order. */
  foods: { id: number; name: string }[];
  /** Proves a one-tap log link came from this widget (see `isQuickLogAllowed`). */
  token: string;
};

/**
 * The home-screen widget (Figma "07 Home-screen widget"): Bellie with a "Snap food!" bubble. Tapping it opens the
 * camera. The medium size also lists up to three saved foods; tapping one logs it at once.
 *
 * This function runs in the widget's own runtime, so it can't use hooks, imports or anything declared outside it:
 * the colours and links are spelled out here, and `SNAP_FOOD_LINK` / `quickLogLink` in lib/widgetLinks.ts must
 * match them. The font is the system's rounded one, the nearest to Nunito, which a widget can't load. The bubble's
 * Gaegu lettering is part of the picture for the same reason.
 */
const FoodWidgetView = (props: FoodWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const cream = '#FFFBF3';
  const tan = '#ECDAB9';
  const ink = '#3A2F25';
  const inkSoft = '#65574A';
  const snapLink = 'adayinmybelly://log/food?camera=1';
  // A very large width fills the space that is left, like "maxWidth: .infinity".
  const fill = 10000;

  const art = props.art ? (
    <Image uiImage={props.art} modifiers={[resizable(), aspectRatio({ contentMode: 'fit' })]} />
  ) : (
    <Text modifiers={[font({ design: 'rounded', weight: 'bold', size: 20 }), foregroundStyle(ink)]}>
      Snap food!
    </Text>
  );

  if (environment.widgetFamily === 'systemSmall') {
    return <VStack modifiers={[containerBackground(cream, 'widget'), widgetURL(snapLink)]}>{art}</VStack>;
  }

  const pills = props.foods.map((food) => (
    <Link key={food.id} destination={`adayinmybelly://log/food?quickLog=${food.id}&t=${props.token}`}>
      <HStack
        modifiers={[
          padding({ horizontal: 16 }),
          frame({ maxWidth: fill, height: 40, alignment: 'leading' }),
          background(tan, shapes.roundedRectangle({ cornerRadius: 16 })),
        ]}>
        <Text
          modifiers={[
            font({ design: 'rounded', weight: 'semibold', size: 15 }),
            foregroundStyle(ink),
            lineLimit(1),
          ]}>
          {food.name}
        </Text>
        <Spacer />
      </HStack>
    </Link>
  ));

  return (
    <HStack spacing={8} modifiers={[containerBackground(cream, 'widget'), widgetURL(snapLink)]}>
      <VStack modifiers={[frame({ width: 132 })]}>{art}</VStack>
      <VStack spacing={8} modifiers={[frame({ maxWidth: fill })]}>
        {pills.length > 0 ? (
          pills
        ) : (
          <Text modifiers={[font({ design: 'rounded', size: 14 }), foregroundStyle(inkSoft), lineLimit(3)]}>
            Add favorite foods to log them from here.
          </Text>
        )}
      </VStack>
    </HStack>
  );
};

export default createWidget<FoodWidgetProps>('FoodWidget', FoodWidgetView);
