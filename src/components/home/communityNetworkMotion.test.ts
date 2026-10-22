import { describe, expect, it } from 'vitest';
import { pointAlongFlow, sampleBezierFlow } from './communityNetworkMotion';

describe('community network flow path', () => {
  it('starts and ends on its connected nodes', () => {
    const path = sampleBezierFlow({ x: 40, y: 80 }, { x: 420, y: 280 }, 45);

    expect(pointAlongFlow(path, 0)).toEqual({ x: 40, y: 80 });
    expect(pointAlongFlow(path, 1)).toEqual({ x: 420, y: 280 });
  });

  it('keeps movement distance nearly even across the curved path', () => {
    const path = sampleBezierFlow({ x: 40, y: 80 }, { x: 420, y: 280 }, 45);
    const points = Array.from({ length: 11 }, (_, index) => pointAlongFlow(path, index / 10));
    const steps = points.slice(1).map((point, index) => Math.hypot(point.x - points[index].x, point.y - points[index].y));

    expect(Math.max(...steps) / Math.min(...steps)).toBeLessThan(1.08);
  });
});
