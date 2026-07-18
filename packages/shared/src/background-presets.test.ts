import { describe, it, expect } from 'vitest';
import { BACKGROUND_GRADIENT_PRESETS, resolveBoardBackground } from './background-presets.js';

describe('BACKGROUND_GRADIENT_PRESETS', () => {
  it('has 10 presets with unique ids', () => {
    expect(BACKGROUND_GRADIENT_PRESETS).toHaveLength(10);
    const ids = BACKGROUND_GRADIENT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every preset has a name and a linear-gradient css value', () => {
    for (const preset of BACKGROUND_GRADIENT_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.css).toMatch(/^linear-gradient\(/);
    }
  });

  it('is stable', () => {
    expect(BACKGROUND_GRADIENT_PRESETS.map((p) => p.id)).toEqual([
      'ocean',
      'sunset',
      'forest',
      'lavender',
      'flamingo',
      'midnight',
      'aqua',
      'citrus',
      'mint',
      'slate',
    ]);
  });
});

describe('resolveBoardBackground', () => {
  it('returns the color value for color backgrounds', () => {
    expect(resolveBoardBackground('color', '#123abc')).toBe('#123abc');
  });

  it('resolves gradient ids to their css', () => {
    expect(resolveBoardBackground('gradient', 'ocean')).toContain('linear-gradient');
  });

  it('returns empty string for unset or unknown backgrounds', () => {
    expect(resolveBoardBackground(null, null)).toBe('');
    expect(resolveBoardBackground('gradient', 'nope')).toBe('');
    expect(resolveBoardBackground('color', null)).toBe('');
  });
});
