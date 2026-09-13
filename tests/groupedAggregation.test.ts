import { describe, expect, test } from 'bun:test';
import { getGroupedAggregationConflict } from '../src/features/providers/groupedProviders';
import type { GroupedProviderRaw } from '../src/features/providers/types';

const emptyRaw = (): GroupedProviderRaw => ({
  openai: [],
  claude: [],
  codex: [],
  gemini: [],
});

describe('grouped aggregation safety', () => {
  test('detects multiple configs for one protocol', () => {
    const raw = emptyRaw();
    raw.codex = [
      { index: 0, config: { apiKey: 'first' } },
      { index: 1, config: { apiKey: 'second' } },
    ];

    expect(getGroupedAggregationConflict(raw)).toBe('multiple-configs');
  });

  test('detects multiple OpenAI API keys in one config', () => {
    const raw = emptyRaw();
    raw.openai = [
      {
        index: 0,
        config: {
          name: 'Grouped',
          baseUrl: 'https://example.com/v1',
          apiKeyEntries: [{ apiKey: 'first' }, { apiKey: 'second' }],
        },
      },
    ];

    expect(getGroupedAggregationConflict(raw)).toBe('multiple-openai-keys');
  });

  test('allows the supported one-config-per-protocol shape', () => {
    const raw = emptyRaw();
    raw.codex = [{ index: 0, config: { apiKey: 'codex' } }];
    raw.openai = [
      {
        index: 0,
        config: {
          name: 'Grouped',
          baseUrl: 'https://example.com/v1',
          apiKeyEntries: [{ apiKey: 'openai' }],
        },
      },
    ];

    expect(getGroupedAggregationConflict(raw)).toBeNull();
  });
});
