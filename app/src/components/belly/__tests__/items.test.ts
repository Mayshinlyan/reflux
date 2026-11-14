import { ITEM_KEYS } from '@/lib/bellieItems';
import { BELLIE_STAGES } from '@/lib/bellieStage';

import { ITEM_ART, ITEM_DRAW_ORDER, itemRect } from '../items';
import { bellyLayout } from '../stages';

describe('item art', () => {
  it('has a whole SVG for every item, and draws every item once', () => {
    for (const key of ITEM_KEYS) {
      const { xml, width, height } = ITEM_ART[key];
      expect(xml.startsWith('<svg')).toBe(true);
      expect(xml.trimEnd().endsWith('</svg>')).toBe(true);
      expect(xml).toContain(`viewBox="0 0 ${width} ${height}"`);
    }
    expect([...ITEM_DRAW_ORDER].sort()).toEqual([...ITEM_KEYS].sort());
  });
});

describe('itemRect', () => {
  it('puts the hats on the top of the body, over the sprout, at every stage', () => {
    for (const stage of BELLIE_STAGES) {
      const layout = bellyLayout(stage, 200);
      for (const key of ['hat', 'chef', 'night'] as const) {
        const rect = itemRect(key, layout);
        // The brim is inside the body's top and the crown above it.
        expect(rect.top).toBeLessThan(layout.body.y);
        expect(rect.top + rect.height).toBeGreaterThan(layout.body.y);
        expect(rect.left).toBeGreaterThan(layout.body.x - 1);
        expect(rect.left + rect.width).toBeLessThan(layout.body.x + layout.body.width + 1);
      }
    }
  });

  it('puts the glasses and sunglasses over the eyes, centred between them', () => {
    for (const stage of BELLIE_STAGES) {
      const layout = bellyLayout(stage, 200);
      const middle = (layout.eyes.left + layout.eyes.right) / 2;
      for (const key of ['glasses', 'shades'] as const) {
        const rect = itemRect(key, layout);
        expect(rect.left + rect.width / 2).toBeCloseTo(middle, 0);
        expect(rect.top).toBeLessThan(layout.eyes.y);
        expect(rect.top + rect.height).toBeGreaterThan(layout.eyes.y);
      }
    }
  });

  it('puts the scarf and bow tie below the eyes, still on the body', () => {
    for (const stage of BELLIE_STAGES) {
      const layout = bellyLayout(stage, 200);
      for (const key of ['scarf', 'bow'] as const) {
        const rect = itemRect(key, layout);
        expect(rect.top).toBeGreaterThan(layout.eyes.y);
        expect(rect.top).toBeLessThan(layout.body.y + layout.body.height);
      }
      // The band of the scarf and the whole bow tie stay on the body, even on a short baby.
      const s = layout.body.width / 134;
      expect(itemRect('scarf', layout).top + 26 * s).toBeLessThanOrEqual(layout.body.y + layout.body.height);
      expect(itemRect('bow', layout).top + 30 * s).toBeLessThanOrEqual(layout.body.y + layout.body.height);
    }
  });

  it('scales with the body it is on: the hat is 90% of the body wide at every stage', () => {
    for (const stage of BELLIE_STAGES) {
      const layout = bellyLayout(stage, 200);
      expect(itemRect('hat', layout).width / layout.body.width).toBeCloseTo(0.9, 1);
    }
  });
});
