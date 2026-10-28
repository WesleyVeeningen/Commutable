import { getResolution } from 'h3-js';
import { describe, expect, it } from 'vitest';
import { bboxAround, buildGrid, estimateCellCount } from './grid';
import { chunk } from './batch';
import { heatHex, oklchToHex } from './scale';

const rotterdam = { lng: 4.4792, lat: 51.9225 };

describe('grid', () => {
  it('pads the bounding box by the margin', () => {
    const b = bboxAround([rotterdam], 15);
    expect(b.north - b.south).toBeCloseTo(30 / 110.574, 3);
    expect(b.east - b.west).toBeGreaterThan(b.north - b.south); // lng degrees are shorter
  });

  it('uses res 7 for coarse and res 8 for fine', () => {
    const coarse = buildGrid([rotterdam], 'coarse');
    const fine = buildGrid([rotterdam], 'fine');
    expect(getResolution(coarse.cells[0])).toBe(7);
    expect(getResolution(fine.cells[0])).toBe(8);
    expect(fine.cells.length).toBeGreaterThan(coarse.cells.length * 5);
    expect(coarse.centres).toHaveLength(coarse.cells.length);
  });

  it('roughly matches the estimate', () => {
    const g = buildGrid([rotterdam], 'coarse');
    const est = estimateCellCount(g.bbox, 'coarse');
    expect(g.cells.length / est).toBeGreaterThan(0.7); // H3 cell area varies with latitude
    expect(g.cells.length / est).toBeLessThan(1.4);
  });

  it('falls back to coarse when fine would exceed the cap', () => {
    const g = buildGrid([rotterdam, { lng: 5.12, lat: 52.09 }], 'fine', 15, 2000);
    expect(g.resolution).toBe('coarse');
    expect(g.downgraded).toBe(true);
    expect(g.cells.length).toBeLessThanOrEqual(2000);
  });

  it('never exceeds the cap', () => {
    const g = buildGrid(
      [
        { lng: 2, lat: 48 },
        { lng: 6, lat: 52 },
      ],
      'coarse',
      15,
      500,
    );
    expect(g.cells).toHaveLength(500);
  });
});

describe('helpers', () => {
  it('chunks arrays', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('converts oklch to hex', () => {
    expect(oklchToHex(1, 0, 0)).toBe('#ffffff');
    expect(oklchToHex(0, 0, 0)).toBe('#000000');
    expect(heatHex(0, false)).toMatch(/^#[0-9a-f]{6}$/);
    // dark mode is darker
    expect(heatHex(0.5, true)).not.toBe(heatHex(0.5, false));
  });
});
