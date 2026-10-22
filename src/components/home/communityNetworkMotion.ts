export type FlowPoint = { x: number; y: number };
export type FlowSample = FlowPoint & { distance: number };

export function sampleBezierFlow(start: FlowPoint, end: FlowPoint, bend: number, sampleCount = 80) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;
  const control1 = { x: start.x + dx / 3 + normalX * bend, y: start.y + dy / 3 + normalY * bend };
  const control2 = { x: start.x + dx * 2 / 3 + normalX * bend, y: start.y + dy * 2 / 3 + normalY * bend };
  const samples: FlowSample[] = [];
  let distance = 0;

  for (let index = 0; index <= sampleCount; index += 1) {
    const t = index / sampleCount;
    const inverse = 1 - t;
    const point = {
      x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * control1.x + 3 * inverse * t ** 2 * control2.x + t ** 3 * end.x,
      y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * control1.y + 3 * inverse * t ** 2 * control2.y + t ** 3 * end.y,
    };
    if (index > 0) distance += Math.hypot(point.x - samples[index - 1].x, point.y - samples[index - 1].y);
    samples.push({ ...point, distance });
  }

  return { samples, length: distance };
}

export function pointAlongFlow(path: { samples: FlowSample[]; length: number }, progress: number): FlowPoint {
  const target = Math.max(0, Math.min(1, progress)) * path.length;
  let low = 0;
  let high = path.samples.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (path.samples[middle].distance < target) low = middle + 1;
    else high = middle;
  }

  const after = path.samples[low];
  const before = path.samples[Math.max(0, low - 1)];
  const span = after.distance - before.distance || 1;
  const ratio = (target - before.distance) / span;
  return {
    x: before.x + (after.x - before.x) * ratio,
    y: before.y + (after.y - before.y) * ratio,
  };
}
