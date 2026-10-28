import { describe, expect, it } from 'vitest';
import { nextWeekdayAt, StopIndex, transitSeconds, walkMinutes, type StopTime } from './transit';

// ~0.009° latitude ≈ 1 km
const dest = { lng: 4.47, lat: 51.91 };
const at = (kmNorth: number, kmEast = 0) => ({
  lat: dest.lat + kmNorth / 111.2,
  lng: dest.lng + kmEast / (111.32 * Math.cos((dest.lat * Math.PI) / 180)),
});

describe('walkMinutes', () => {
  it('uses 5 km/h with a 1.3 detour factor', () => {
    // 1 km straight → 1.3 km walked → 15.6 min
    expect(walkMinutes(dest, at(1))).toBeCloseTo(15.6, 0);
  });
});

describe('transitSeconds', () => {
  it('walks to the best nearby stop and adds its time to the destination', () => {
    const source = at(10);
    const stops: StopTime[] = [
      { ...at(10.3), minutes: 30 }, // ~4.7 min walk + 30 = ~34.7
      { ...at(10, 0.5), minutes: 25 }, // ~7.8 min walk + 25 = ~32.8 ← best
      { ...at(5), minutes: 10 }, // too far to walk to
    ];
    const s = transitSeconds(source, dest, new StopIndex(stops));
    expect(s! / 60).toBeCloseTo(25 + walkMinutes(source, stops[1]), 1);
  });

  it('ignores stops beyond a 15-minute walk', () => {
    const source = at(10);
    const s = transitSeconds(source, dest, new StopIndex([{ ...at(11.2), minutes: 5 }]));
    expect(s).toBeNull();
  });

  it('walks straight there when that is quicker', () => {
    const source = at(0.5);
    const s = transitSeconds(source, dest, new StopIndex([{ ...at(0.5, 0.05), minutes: 20 }]));
    expect(s! / 60).toBeCloseTo(walkMinutes(source, dest), 1);
  });

  it('is unreachable with no stops in range and too far to walk', () => {
    expect(transitSeconds(at(20), dest, new StopIndex([]))).toBeNull();
  });

  it('finds stops across bucket edges in every direction', () => {
    const source = at(10, 10);
    const around = [at(10.8, 10), at(9.2, 10), at(10, 10.8), at(10, 9.2)];
    for (const p of around) {
      const s = transitSeconds(source, dest, new StopIndex([{ ...p, minutes: 40 }]));
      expect(s).not.toBeNull();
    }
  });
});

describe('StopIndex', () => {
  it('matches a brute-force search far from the equator and prime meridian', () => {
    const stops: StopTime[] = [];
    for (let i = 0; i < 400; i++)
      stops.push({ lat: 59.9 + (i % 20) * 0.004, lng: 140 + Math.floor(i / 20) * 0.007, minutes: i });
    const index = new StopIndex(stops);
    const p = { lat: 59.93, lng: 140.06 };
    const brute = stops.filter((s) => walkMinutes(p, s) <= 15).length;
    expect(index.near(p)).toHaveLength(brute);
  });
});

describe('nextWeekdayAt', () => {
  it('picks tomorrow when tomorrow is a weekday', () => {
    const d = nextWeekdayAt(new Date(2026, 9, 28, 14, 0), 8, 30); // Wed
    expect([d.getDay(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([4, 29, 8, 30]);
  });

  it('skips the weekend', () => {
    const fri = nextWeekdayAt(new Date(2026, 9, 30, 7, 0), 8, 30); // Fri → Mon
    expect([fri.getDay(), fri.getDate()]).toEqual([1, 2]);
    const sat = nextWeekdayAt(new Date(2026, 9, 31, 12, 0), 8, 30); // Sat → Mon
    expect([sat.getDay(), sat.getDate()]).toEqual([1, 2]);
  });
});
