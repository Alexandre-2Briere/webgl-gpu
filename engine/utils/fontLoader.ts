import type { FontFamily } from '../types';

const FONT_CONFIG: Record<FontFamily, { name: string; regularUrl: string; italicUrl: string }> = {
  'chivo-mono': {
    name:       'ChivoMono Variable',
    regularUrl: new URL('../../../assets/font/Chivo_Mono,Red_Hat_Mono/Chivo_Mono/ChivoMono-VariableFont_wght.ttf', import.meta.url).href,
    italicUrl:  new URL('../../../assets/font/Chivo_Mono,Red_Hat_Mono/Chivo_Mono/ChivoMono-Italic-VariableFont_wght.ttf', import.meta.url).href,
  },
  'red-hat-mono': {
    name:       'RedHatMono Variable',
    regularUrl: new URL('../../../assets/font/Chivo_Mono,Red_Hat_Mono/Red_Hat_Mono/RedHatMono-VariableFont_wght.ttf', import.meta.url).href,
    italicUrl:  new URL('../../../assets/font/Chivo_Mono,Red_Hat_Mono/Red_Hat_Mono/RedHatMono-Italic-VariableFont_wght.ttf', import.meta.url).href,
  },
};

const _cache = new Map<FontFamily, Promise<void>>();

/** Loads both the regular and italic variable font faces for the given family. Each family loads at most once. */
export function loadVariableFont(family: FontFamily): Promise<void> {
  const cached = _cache.get(family);
  if (cached !== undefined) return cached;

  const config = FONT_CONFIG[family];
  const promise = (async () => {
    const regular = new FontFace(config.name, `url(${config.regularUrl})`);
    const italic  = new FontFace(config.name, `url(${config.italicUrl})`, { style: 'italic' });
    await Promise.all([regular.load(), italic.load()]);
    document.fonts.add(regular);
    document.fonts.add(italic);
  })();

  _cache.set(family, promise);
  return promise;
}
