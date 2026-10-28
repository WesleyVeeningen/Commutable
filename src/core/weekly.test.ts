import { describe, expect, it } from 'vitest';
import type { Place } from './types';
import {
  breakdown,
  cacheKey,
  distribution,
  formatMinutes,
  legendLabels,
  quickerThan,
  scalePosition,
  sumWeekly,
  targetKey,
  weeklyMinutes,
} from './weekly';

const place = (id: string, mode: Place['mode'], trips: number, lng = 4.5, lat = 52): Place => ({
  id,
  name: id,
  address: { lng, lat, label: id, area: '' },
  mode,
  tripsPerWeek: trips,
});

describe('weeklyMinutes', () => {
  it('counts both directions for every trip', () => {
    // 24 min each way, 5× a week → 24 × 2 × 5 = 240
    expect(weeklyMinutes(24 * 60, 5)).toBe(240);
    expect(weeklyMinutes(90, 1)).toBe(3);
  });
});

describe('cache keys', () => {
  it('round coordinates to 5 decimals and include mode and cell', () => {
    expect(cacheKey({ lng: 4.123456789, lat: 51.987654321 }, 'bike', '87abc')).toBe('51.98765,4.12346|bike|87abc');
  });
  it('differ by mode', () => {
    const loc = { lng: 1, lat: 2 };
    expect(targetKey(loc, 'car')).not.toBe(targetKey(loc, 'walk'));
  });
});

describe('sumWeekly', () => {
  it('adds every place, weighted by its own trips', () => {
    const a = place('a', 'bike', 5, 1);
    const b = place('b', 'car', 1, 2);
    const durations = new Map([
      [targetKey(a.address, 'bike'), [600, 1200]],
      [targetKey(b.address, 'car'), [300, null]],
    ]);
    // cell 0: 10 min×2×5 = 100 + 5×2×1 = 10 → 110; cell 1: b unreachable → null
    expect(sumWeekly([a, b], durations, 2)).toEqual([110, null]);
  });

  it('returns zeros with no places', () => {
    expect(sumWeekly([], new Map(), 3)).toEqual([0, 0, 0]);
  });
});

describe('distribution', () => {
  const values = [...Array.from({ length: 100 }, (_, i) => i + 1), null, null];

  it('ignores unreachable cells and takes the 2nd / 98th percentile', () => {
    const d = distribution(values);
    expect(d.sorted).toHaveLength(100);
    expect(d.lo).toBe(3);
    expect(d.hi).toBe(99);
  });

  it('positions values on a clamped 0..1 scale', () => {
    const d = distribution(values);
    expect(scalePosition(3, d)).toBe(0);
    expect(scalePosition(51, d)).toBeCloseTo(0.5);
    expect(scalePosition(500, d)).toBe(1);
  });

  it('ranks a point against the map', () => {
    const d = distribution(values);
    expect(quickerThan(25, d)).toBeCloseTo(0.75);
    expect(quickerThan(0, d)).toBe(1);
    expect(quickerThan(1000, d)).toBe(0);
  });

  it('handles an empty map', () => {
    const d = distribution([null]);
    expect(d).toEqual({ sorted: [], lo: 0, hi: 0 });
    expect(quickerThan(10, d)).toBe(0);
  });
});

describe('breakdown', () => {
  it('lists each place and totals them', () => {
    const work = place('work', 'bike', 5);
    const gym = place('gym', 'walk', 2);
    const b = breakdown([work, gym], new Map([['work', 24 * 60], ['gym', 600]]));
    expect(b.rows.map((r) => r.weeklyMin)).toEqual([240, 40]);
    expect(b.rows[0].oneWayMin).toBe(24);
    expect(b.totalMin).toBe(280);
  });

  it('has no total if a place is unreachable', () => {
    const b = breakdown([place('x', 'car', 1)], new Map([['x', null]]));
    expect(b.totalMin).toBeNull();
    expect(b.rows[0].weeklyMin).toBeNull();
  });
});

describe('formatting', () => {
  it('formats minutes like the design', () => {
    expect(formatMinutes(250)).toBe('4h 10m');
    expect(formatMinutes(35.4)).toBe('35m');
    expect(formatMinutes(60)).toBe('1h 0m');
  });

  it('builds legend labels in hours', () => {
    expect(legendLabels({ sorted: [], lo: 180, hi: 960 })).toEqual(['3h', '10h', '16h+']);
  });
});
