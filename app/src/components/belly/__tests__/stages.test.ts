import { BELLIE_STAGES } from '@/lib/bellieStage';
import type { BellyMood } from '@/lib/belly';

import { bellyLayout, bellySvg, STAGE_HEIGHT, stageArt } from '../stages';

const MOODS: BellyMood[] = ['happy', 'okay', 'caution', 'avoid'];

describe('bellySvg without the sprout (under a hat)', () => {
  it('drops the leaves and stem at every stage and mood, and keeps the body and the face', () => {
    for (const stage of BELLIE_STAGES) {
      for (const mood of MOODS) {
        const whole = bellySvg(stage, mood);
        const bare = bellySvg(stage, mood, false);
        expect(whole).toMatch(/#92B971/);
        expect(bare).not.toMatch(/#92B971|#B8D68E/);
        expect(bare.startsWith('<svg')).toBe(true);
        expect(bare.trimEnd().endsWith('</svg>')).toBe(true);
        expect(bare).toContain('#FCE3BD');
        // Only the sprout went: the face is still drawn.
        expect(bare.split('\n').length).toBeGreaterThan(whole.split('\n').length - 12);
        expect(bare.split('\n').length).toBeLessThan(whole.split('\n').length);
      }
    }
  });
});

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
