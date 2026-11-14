import type { ItemKey } from '@/lib/bellieItems';

import type { BellyLayout } from './stages';

// The things Bellie wears, exported from the Figma "Belly items" (2026-11-12). Each is drawn on its own box, in its own
// units, and placed on the body by `itemRect`.

type Art = { width: number; height: number; xml: string };

export const ITEM_ART: Record<ItemKey, Art> = {
  hat: {
    width: 120,
    height: 92,
    xml: `<svg width="120" height="92" viewBox="0 0 120 92" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="12" y="24" width="96" height="44" rx="22" fill="#F3D3C0"/>
<rect y="66" width="120" height="12" rx="6" fill="#C8664A"/>
<circle cx="60" cy="19" r="9" fill="#D9A441"/>
</svg>`,
  },
  chef: {
    width: 120,
    height: 100,
    xml: `<svg width="120" height="100" viewBox="0 0 120 100" fill="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="28" cy="40" r="21" fill="white" stroke="#E6D9C0" stroke-width="2"/>
<circle cx="92" cy="40" r="21" fill="white" stroke="#E6D9C0" stroke-width="2"/>
<circle cx="60" cy="28" r="25" fill="white" stroke="#E6D9C0" stroke-width="2"/>
<rect x="15" y="63" width="90" height="24" rx="7" fill="white" stroke="#E6D9C0" stroke-width="2"/>
</svg>`,
  },
  night: {
    width: 133,
    height: 90,
    xml: `<svg width="133" height="90" viewBox="0 0 133 90" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M56 24C69.66 24 81.98 27.21 90.85 32.35C99.74 37.51 105 44.49 105 52C105 59.5 99.74 66.48 90.85 71.64C81.98 76.78 69.66 80 56 80C42.33 80 30.01 76.78 21.14 71.64C12.25 66.48 7 59.5 7 52C7 44.49 12.25 37.51 21.14 32.35C30.01 27.21 42.33 24 56 24Z" fill="#D3E4F2" stroke="#3A5F85" stroke-width="2"/>
<rect x="7" y="61" width="98" height="16" rx="8" fill="white" stroke="#3A5F85" stroke-width="2"/>
<path d="M111.8 41.84C116.95 44.24 121.1 47.39 123.67 50.50C126.29 53.67 127.03 56.5 126.12 58.45C125.21 60.4 122.57 61.65 118.46 61.68C114.43 61.71 109.34 60.55 104.19 58.15C99.04 55.75 94.89 52.6 92.32 49.49C89.7 46.32 88.96 43.49 89.87 41.54C90.78 39.59 93.42 38.35 97.53 38.31C101.56 38.28 106.65 39.44 111.8 41.84Z" fill="#D3E4F2" stroke="#3A5F85" stroke-width="2"/>
<circle cx="124" cy="62" r="8" fill="white" stroke="#3A5F85" stroke-width="2"/>
</svg>`,
  },
  phones: {
    width: 160,
    height: 82,
    xml: `<svg width="160" height="82" viewBox="0 0 160 82" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M11 37C57 -9 103 -9 149 37" stroke="#65574A" stroke-width="5" stroke-linecap="round"/>
<rect y="31.5" width="22" height="42" rx="11" fill="#65574A"/>
<rect x="138" y="31.5" width="22" height="42" rx="11" fill="#65574A"/>
</svg>`,
  },
  glasses: {
    width: 70,
    height: 30,
    xml: `<svg width="70" height="30" viewBox="0 0 70 30" fill="none" xmlns="http://www.w3.org/2000/svg">
<circle cx="15" cy="15" r="13.5" stroke="#3A2F25" stroke-width="3"/>
<circle cx="54" cy="15" r="13.5" stroke="#3A2F25" stroke-width="3"/>
<rect x="30" y="13" width="9" height="3" rx="1.5" fill="#3A2F25"/>
</svg>`,
  },
  shades: {
    width: 72,
    height: 26,
    xml: `<svg width="72" height="26" viewBox="0 0 72 26" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="32" height="26" rx="11" fill="#3A2F25"/>
<rect x="40" width="32" height="26" rx="11" fill="#3A2F25"/>
<rect x="30" y="9" width="12" height="4" rx="2" fill="#3A2F25"/>
</svg>`,
  },
  bow: {
    width: 44,
    height: 30,
    xml: `<svg width="44" height="30" viewBox="0 0 44 30" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M20 15L2 3V27L20 15Z" fill="#F3D5DC" stroke="#8A3D52" stroke-width="2" stroke-linecap="round"/>
<path d="M24 15L42 3V27L24 15Z" fill="#F3D5DC" stroke="#8A3D52" stroke-width="2" stroke-linecap="round"/>
<rect x="17" y="10" width="10" height="10" rx="3" fill="#F3D5DC" stroke="#8A3D52" stroke-width="2"/>
</svg>`,
  },
  scarf: {
    width: 126,
    height: 86,
    xml: `<svg width="126" height="86" viewBox="0 0 126 86" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect width="126" height="26" rx="13" fill="#C8664A"/>
<rect x="14" width="10" height="26" fill="#F3D3C0"/>
<rect x="50" width="10" height="26" fill="#F3D3C0"/>
<rect x="86" width="10" height="26" fill="#F3D3C0"/>
<rect x="88" y="14" width="28" height="64" rx="8" fill="#C8664A"/>
<rect x="88" y="50" width="28" height="8" fill="#F3D3C0"/>
<rect x="88" y="64" width="28" height="8" fill="#F3D3C0"/>
</svg>`,
  },
};

/** Back to front: the scarf and bow tie first, the headphones and hats over them, the glasses on the face last. */
export const ITEM_DRAW_ORDER: readonly ItemKey[] = [
  'scarf',
  'bow',
  'phones',
  'night',
  'chef',
  'hat',
  'glasses',
  'shades',
];

export type ItemRect = { left: number; top: number; width: number; height: number };

/**
 * Where an item sits on a Bellie, in pixels inside the Belly's box. An item is as big as the body is wide (the sizes
 * were drawn against a body 134 wide), and each is placed from the top of the body, the middle of the eyes or the
 * middle of the body, the way it was in the Figma dress-up page.
 */
export function itemRect(key: ItemKey, layout: BellyLayout): ItemRect {
  const art = ITEM_ART[key];
  const s = layout.body.width / 134;
  const cx = layout.body.x + layout.body.width / 2;
  const top = layout.body.y;
  const ex = (layout.eyes.left + layout.eyes.right) / 2;
  const ey = layout.eyes.y;
  const origin: Record<ItemKey, [number, number]> = {
    hat: [cx - 60 * s, top + 16 * s - 66 * s],
    chef: [cx - 60 * s, top + 24 * s - 88 * s],
    night: [cx - 65 * s, top + 22 * s - 78 * s],
    phones: [cx - 80 * s, ey - 51 * s],
    glasses: [ex - 35 * s, ey - 15 * s],
    shades: [ex - 36 * s, ey - 13 * s],
    bow: [cx - 22 * s, ey + 41 * s],
    scarf: [cx - 63 * s, ey + 31 * s],
  };
  const [left, drawnTop] = origin[key];
  // The neck items were placed for a tall body: on a short one (a baby) they would hang past its bottom edge, so the
  // band is held on the body. Their tails (the scarf's) still hang below, over the feet.
  const band = (key === 'scarf' ? 26 : art.height) * s;
  const y =
    key === 'scarf' || key === 'bow'
      ? Math.min(drawnTop, layout.body.y + layout.body.height - band * 1.1)
      : drawnTop;
  return { left, top: y, width: art.width * s, height: art.height * s };
}
