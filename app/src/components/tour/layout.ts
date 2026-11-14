import type { TargetRect } from '@/components/FloatingTabBar';

type Size = { width: number; height: number };

/** The card's side margin, its widest on a big screen, and the gap between it and the cut-out. */
export const CARD_MARGIN = 16;
const CARD_MAX_WIDTH = 400;
const GAP = 14;
export const TAIL_WIDTH = 22;
export const TAIL_HEIGHT = 12;
/** The tail stays this far inside the card's rounded corners. */
const TAIL_INSET = 28;

/** The cut-out: the target with its padding, kept on screen. */
export function holeFor(target: TargetRect, pad: number, screen: Size): TargetRect {
  const x = Math.max(0, target.x - pad);
  const y = Math.max(0, target.y - pad);
  return {
    x,
    y,
    width: Math.min(screen.width, target.x + target.width + pad) - x,
    height: Math.min(screen.height, target.y + target.height + pad) - y,
  };
}

export type Placement = {
  left: number;
  width: number;
  top: number;
  /** Where the tail sits (left edge), and which edge of the card it grows from; none when there is no target. */
  tail: { left: number; side: 'above' | 'below' } | null;
};

/**
 * Puts the card on the side of the cut-out with more room (below first), so tabs at the bottom get it above and
 * Bellie gets it below. With no target it is centred. `top`/`bottom` are the safe-area insets it keeps clear of.
 * `anchor` pins the card to the top or bottom of the screen instead (a whole page behind it, or a cut-out the card
 * must not cover); it then has no tail.
 */
export function placeCard(
  hole: TargetRect | null,
  screen: Size,
  cardHeight: number,
  insets: { top: number; bottom: number },
  anchor?: 'top' | 'bottom',
): Placement {
  const width = Math.min(screen.width - 2 * CARD_MARGIN, CARD_MAX_WIDTH);
  const left = (screen.width - width) / 2;
  const minTop = insets.top + CARD_MARGIN;
  const maxTop = Math.max(minTop, screen.height - insets.bottom - CARD_MARGIN - cardHeight);
  const clamp = (top: number) => Math.min(Math.max(top, minTop), maxTop);

  if (anchor) return { left, width, top: anchor === 'top' ? minTop : maxTop, tail: null };
  if (!hole) return { left, width, top: clamp((screen.height - cardHeight) / 2), tail: null };

  const belowTop = hole.y + hole.height + GAP;
  const aboveTop = hole.y - GAP - cardHeight;
  const roomBelow = maxTop - belowTop;
  const roomAbove = aboveTop - minTop;
  const below = roomBelow >= 0 || roomBelow >= roomAbove;

  const centre = hole.x + hole.width / 2;
  const tailLeft = Math.min(
    Math.max(centre - TAIL_WIDTH / 2, left + TAIL_INSET),
    left + width - TAIL_INSET - TAIL_WIDTH,
  );
  return {
    left,
    width,
    top: clamp(below ? belowTop : aboveTop),
    // The tail grows from the card's top edge when the card is below the target, and from its bottom edge when above.
    tail: { left: tailLeft, side: below ? 'below' : 'above' },
  };
}
