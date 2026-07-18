import { describe, it, expect } from 'vitest';
import {
  BACKGROUND_GRADIENT_PRESETS,
  resolveBoardBackground,
  resolveBoardAccent,
} from './background-presets.js';

describe('BACKGROUND_GRADIENT_PRESETS', () => {
  it('has 10 presets with unique ids', () => {
    expect(BACKGROUND_GRADIENT_PRESETS).toHaveLength(10);
    const ids = BACKGROUND_GRADIENT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every preset has a name, a linear-gradient css value, and a hex accent', () => {
    for (const preset of BACKGROUND_GRADIENT_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.css).toMatch(/^linear-gradient\(/);
      expect(preset.accent).toMatch(/^#[0-9a-f]{6}$/i);
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

describe('resolveBoardAccent', () => {
  it('uses the color itself for color backgrounds', () => {
    expect(resolveBoardAccent('color', '#123abc')).toBe('#123abc');
  });

  it('uses the preset accent for gradients', () => {
    expect(resolveBoardAccent('gradient', 'ocean')).toBe('#0079bf');
  });

  it('returns empty string when unset or unknown', () => {
    expect(resolveBoardAccent(null, null)).toBe('');
    expect(resolveBoardAccent('gradient', 'nope')).toBe('');
  });
});
