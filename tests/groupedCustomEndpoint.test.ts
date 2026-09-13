import { describe, expect, test } from 'bun:test';
import { openaiToResource } from '../src/features/providers/adapters';
import {
  KIMI_OPENAI_BASE_URL,
  KIMI_PROVIDER_NAME,
  buildKimiRaw,
} from '../src/features/providers/kimi';
import { normalizeConfigResponse } from '../src/services/api/transformers';

const openAIConfig = (name: string, baseUrl: string) => ({
  openaiCompatibility: [
    {
      name,
      baseUrl,
      apiKeyEntries: [{ apiKey: 'test-key' }],
    },
  ],
});

const customOpenAIConfig = (name: string) => openAIConfig(name, 'https://gateway.example.com/v1');

const mixedOpenAIConfig = (name: string, officialBaseUrl: string) => ({
  openaiCompatibility: [
    {
      name,
      baseUrl: officialBaseUrl,
      apiKeyEntries: [{ apiKey: 'official-key' }],
    },
    {
      name,
      baseUrl: 'https://gateway.example.com/v1',
      apiKeyEntries: [{ apiKey: 'custom-key' }],
    },
  ],
});

describe('grouped provider custom endpoint isolation', () => {
  test('keeps Kimi-named custom endpoints in the generic OpenAI group', () => {
    expect(buildKimiRaw(customOpenAIConfig(KIMI_PROVIDER_NAME)).openai).toEqual([]);
  });

  test('keeps same-name custom entries outside grouped delete targets', () => {
    expect(
      buildKimiRaw(mixedOpenAIConfig(KIMI_PROVIDER_NAME, KIMI_OPENAI_BASE_URL)).openai.map(
        (item) => item.index
      )
    ).toEqual([0]);
  });

  test('keeps backend indexes when normalization filters an unnamed item', () => {
    const config = normalizeConfigResponse({
      'openai-compatibility': [
        { 'base-url': 'https://invalid.example.com/v1' },
        {
          name: KIMI_PROVIDER_NAME,
          'base-url': KIMI_OPENAI_BASE_URL,
          'api-key-entries': [{ 'api-key': 'official-a' }],
        },
        {
          name: KIMI_PROVIDER_NAME,
          'base-url': 'https://gateway.example.com/v1',
          'api-key-entries': [{ 'api-key': 'custom-key' }],
        },
        {
          name: KIMI_PROVIDER_NAME,
          'base-url': KIMI_OPENAI_BASE_URL,
          'api-key-entries': [{ 'api-key': 'official-b' }],
        },
      ],
    });

    expect(config.openaiCompatibility?.map((item) => item.sourceIndex)).toEqual([1, 2, 3]);
    expect(buildKimiRaw(config).openai.map((item) => item.index)).toEqual([1, 3]);
    expect(openaiToResource(config.openaiCompatibility![1], 1).originalIndex).toBe(2);
  });

  test('still aggregates the official Kimi OpenAI endpoint under any name', () => {
    expect(buildKimiRaw(openAIConfig('custom-name', KIMI_OPENAI_BASE_URL)).openai.length).toBe(1);
  });
});
