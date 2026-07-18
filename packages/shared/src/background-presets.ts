/** Gradient presets selectable as board backgrounds. */
export const BACKGROUND_GRADIENT_PRESETS = [
  { id: 'ocean', name: 'Ocean', css: 'linear-gradient(135deg, #0079bf 0%, #5067c5 100%)' },
  { id: 'sunset', name: 'Sunset', css: 'linear-gradient(135deg, #ff9f1a 0%, #eb5a46 100%)' },
  { id: 'forest', name: 'Forest', css: 'linear-gradient(135deg, #519839 0%, #0f5132 100%)' },
  { id: 'lavender', name: 'Lavender', css: 'linear-gradient(135deg, #c377e0 0%, #6b5b95 100%)' },
  { id: 'flamingo', name: 'Flamingo', css: 'linear-gradient(135deg, #ff78cb 0%, #c377e0 100%)' },
  { id: 'midnight', name: 'Midnight', css: 'linear-gradient(135deg, #344563 0%, #172b4d 100%)' },
  { id: 'aqua', name: 'Aqua', css: 'linear-gradient(135deg, #00c2e0 0%, #0079bf 100%)' },
  { id: 'citrus', name: 'Citrus', css: 'linear-gradient(135deg, #f2d600 0%, #ff9f1a 100%)' },
  { id: 'mint', name: 'Mint', css: 'linear-gradient(135deg, #51e898 0%, #519839 100%)' },
  { id: 'slate', name: 'Slate', css: 'linear-gradient(135deg, #838c91 0%, #344563 100%)' },
] as const;

export type BackgroundGradientId = (typeof BACKGROUND_GRADIENT_PRESETS)[number]['id'];

export type BackgroundType = 'color' | 'gradient';

/** Resolve a board's background fields to a CSS background value ('' when unset/unknown). */
export function resolveBoardBackground(
  backgroundType: BackgroundType | null,
  backgroundValue: string | null,
): string {
  if (backgroundType === 'color' && backgroundValue) return backgroundValue;
  if (backgroundType === 'gradient') {
    return BACKGROUND_GRADIENT_PRESETS.find((p) => p.id === backgroundValue)?.css ?? '';
  }
  return '';
}
