import { afterEach, describe, expect, test } from 'bun:test';
import i18n from '@/i18n';
import { STORAGE_KEY_LANGUAGE, SUPPORTED_LANGUAGES } from '@/utils/constants';
import { getInitialLanguage, isSupportedLanguage } from '@/utils/language';

const globals = ['window', 'navigator', 'localStorage'] as const;
const descriptors = globals.map((key) => Object.getOwnPropertyDescriptor(globalThis, key));

afterEach(() => {
  globals.forEach((key, index) => {
    const descriptor = descriptors[index];
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  });
});

const setBrowser = (language: string, stored: string | null = null) => {
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: {} },
    navigator: { configurable: true, value: { language, languages: [language] } },
    localStorage: {
      configurable: true,
      value: { getItem: (key: string) => (key === STORAGE_KEY_LANGUAGE ? stored : null) },
    },
  });
};

describe('supported UI languages', () => {
  test('loads English and Russian resources with an English fallback', () => {
    expect(SUPPORTED_LANGUAGES).toEqual(['en', 'ru']);
    expect(Object.keys(i18n.options.resources ?? {}).sort()).toEqual(['en', 'ru']);
    expect(i18n.options.fallbackLng).toEqual(['en']);
    expect(isSupportedLanguage('zh-CN')).toBe(false);
    expect(isSupportedLanguage('zh-TW')).toBe(false);
  });

  test('defaults to English without a browser', () => {
    globals.forEach((key) => Reflect.deleteProperty(globalThis, key));
    expect(getInitialLanguage()).toBe('en');
  });

  for (const language of ['zh-CN', 'zh-TW', 'zh-HK', 'zh-Hant', 'de-DE']) {
    test(`falls back to English for ${language} browser and persisted preferences`, () => {
      for (const stored of [
        null,
        language,
        JSON.stringify(language),
        JSON.stringify({ language }),
        JSON.stringify({ state: { language }, version: 0 }),
      ]) {
        setBrowser(language, stored);
        expect(getInitialLanguage()).toBe('en');
      }
    });
  }

  test('detects Russian after discarding a retired preference', () => {
    setBrowser('ru-RU', JSON.stringify({ state: { language: 'zh-CN' } }));
    expect(getInitialLanguage()).toBe('ru');
  });

  test('preserves supported stored preferences over browser detection', () => {
    for (const language of SUPPORTED_LANGUAGES) {
      for (const stored of [
        language,
        JSON.stringify(language),
        JSON.stringify({ language }),
        JSON.stringify({ state: { language }, version: 0 }),
      ]) {
        setBrowser(language === 'en' ? 'ru-RU' : 'en-US', stored);
        expect(getInitialLanguage()).toBe(language);
      }
    }
  });
});
