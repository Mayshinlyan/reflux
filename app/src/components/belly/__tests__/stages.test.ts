import { BELLIE_STAGES } from '@/lib/bellieStage';
import type { BellyMood } from '@/lib/belly';

import { bellyLayout, bellySvg, STAGE_HEIGHT, stageArt } from '../stages';

const MOODS: BellyMood[] = ['happy', 'okay', 'caution', 'avoid'];

describe('bellySvg', () => {
  it('is a whole SVG for every stage and mood, with a different face for each mood', () => {
    for (const stage of BELLIE_STAGES) {
      const drawings = MOODS.map((mood) => bellySvg(stage, mood));
      for (const svg of drawings) {
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
        expect(svg.match(/<svg/g)).toHaveLength(1);
      }
      expect(new Set(drawings).size).toBe(MOODS.length);
    }
  });

  it('draws the sweat drop for caution and avoid only', () => {
    for (const stage of BELLIE_STAGES) {
      expect(bellySvg(stage, 'happy')).not.toContain('#A9D3EA');
      expect(bellySvg(stage, 'okay')).not.toContain('#A9D3EA');
      expect(bellySvg(stage, 'caution')).toContain('#A9D3EA');
      expect(bellySvg(stage, 'avoid')).toContain('#A9D3EA');
    }
  });
});

describe('bellyLayout', () => {
  it('draws a younger Bellie smaller, standing on the bottom of the box', () => {
    const heights = BELLIE_STAGES.map((stage) => bellyLayout(stage, 200).height);
    expect(heights).toEqual([...heights].sort((a, b) => a - b));
    for (const stage of BELLIE_STAGES) {
      const layout = bellyLayout(stage, 200);
      expect(layout.top + layout.height).toBeCloseTo(200);
      expect(layout.height).toBeCloseTo(200 * STAGE_HEIGHT[stage]);
      expect(layout.left).toBeGreaterThanOrEqual(0);
      expect(layout.left + layout.width).toBeLessThanOrEqual(200 + 0.001);
    }
  });

  it('puts the body inside the drawing, and the eyes inside the body', () => {
    for (const stage of BELLIE_STAGES) {
      const layout = bellyLayout(stage, 160);
      const art = stageArt(stage);
      expect(art.body.x + art.body.width).toBeLessThanOrEqual(art.width);
      expect(art.body.y + art.body.height).toBeLessThanOrEqual(art.height);
      expect(layout.eyes.left).toBeGreaterThan(layout.body.x);
      expect(layout.eyes.right).toBeLessThan(layout.body.x + layout.body.width);
      expect(layout.eyes.y).toBeGreaterThan(layout.body.y);
      expect(layout.eyes.y).toBeLessThan(layout.body.y + layout.body.height);
    }
  });
});
