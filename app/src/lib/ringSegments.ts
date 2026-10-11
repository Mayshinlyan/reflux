export type RingSegment = { start: number; end: number };

/** Gap left between neighbouring arcs, in degrees. */
const GAP_DEGREES = 6;

/**
 * The arcs of the Home ring: one per meal, equal in size, clockwise from 12 o'clock (0°). A single
 * meal fills the whole ring; with none there are no arcs and only the track shows.
 */
export function ringSegments(count: number): RingSegment[] {
  if (count <= 0) return [];
  if (count === 1) return [{ start: 0, end: 360 }];
  const span = 360 / count;
  return Array.from({ length: count }, (_, i) => ({
    start: i * span + GAP_DEGREES / 2,
    end: (i + 1) * span - GAP_DEGREES / 2,
  }));
}

/** SVG path for an arc of radius `r` around (cx, cy); angles are clockwise from 12 o'clock. */
export function arcPath(cx: number, cy: number, r: number, { start, end }: RingSegment): string {
  const point = (degrees: number) => {
    const radians = (degrees * Math.PI) / 180;
    return `${(cx + r * Math.sin(radians)).toFixed(3)} ${(cy - r * Math.cos(radians)).toFixed(3)}`;
  };
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${point(start)} A ${r} ${r} 0 ${largeArc} 1 ${point(end)}`;
}
