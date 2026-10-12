import Svg, { Circle, Path } from 'react-native-svg';

export type TabIconProps = {
  size: number;
  /** The solid shape: ink when its tab is selected, a pale surface2 when it is not. */
  color: string;
  /** The door and the clock hands are cut out of the shape in the bar's own colour. */
  cutout: string;
};

const STROKE = { strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

/** Figma "Icon/Today filled": a solid house with its door cut out. */
export function HouseSolid({ size, color, cutout }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        fill={color}
        stroke={color}
        {...STROKE}
      />
      <Path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" stroke={cutout} {...STROKE} />
    </Svg>
  );
}

/** Figma "Icon/History filled": a solid clock face with its hands cut out. */
export function ClockSolid({ size, color, cutout }: TabIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} fill={color} stroke={color} {...STROKE} />
      <Path d="M12 6v6l4 2" stroke={cutout} {...STROKE} />
    </Svg>
  );
}
