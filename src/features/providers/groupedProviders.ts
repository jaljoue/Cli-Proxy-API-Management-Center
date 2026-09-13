/**
 * Grouped providers: one brand whose single credential is written into several
 * protocol configs (OpenAI-compatible, Claude, Codex) and managed as one row.
 */

import {
  KIMI_BASE_URL_OPTIONS,
  KIMI_DISPLAY_NAME,
  KIMI_PROTOCOL_LABELS,
  KIMI_PROVIDER_NAME,
  getKimiProtocolUrls,
  resolveKimiBaseUrl,
} from './kimi';
import type {
  GroupedProtocol,
  GroupedProviderBrand,
  GroupedProviderRaw,
  ProviderBrand,
} from './types';

export interface GroupedProtocolUrls {
  anthropic: string;
  openai: string;
  codex: string;
  gemini: string;
}

export interface GroupedBaseUrlOption {
  id: string;
  descriptionKey?: string;
  baseUrl: string;
  openaiBaseUrl: string;
  codexBaseUrl: string;
  anthropicBaseUrl: string;
  geminiBaseUrl: string;
}

export interface GroupedProviderDefinition {
  brand: GroupedProviderBrand;
  displayName: string;
  providerName: string;
  protocols: readonly GroupedProtocol[];
  protocolLabels: readonly string[];
  defaultProtocol: GroupedProtocol;
  baseUrlOptions: readonly GroupedBaseUrlOption[];
  resolveBaseUrl: (value: string | undefined | null) => string;
  getProtocolUrls: (value: string | undefined | null) => GroupedProtocolUrls;
}

const GROUPED_DEFINITIONS: Record<GroupedProviderBrand, GroupedProviderDefinition> = {
  kimi: {
    brand: 'kimi',
    displayName: KIMI_DISPLAY_NAME,
    providerName: KIMI_PROVIDER_NAME,
    protocols: ['openai', 'claude', 'codex'],
    protocolLabels: KIMI_PROTOCOL_LABELS,
    defaultProtocol: 'openai',
    baseUrlOptions: KIMI_BASE_URL_OPTIONS,
    resolveBaseUrl: resolveKimiBaseUrl,
    getProtocolUrls: getKimiProtocolUrls,
  },
};

export const isGroupedProviderBrand = (brand: ProviderBrand): brand is GroupedProviderBrand =>
  brand === 'kimi';

export type GroupedAggregationConflict = 'multiple-configs' | 'multiple-openai-keys';

export const getGroupedAggregationConflict = (
  raw: GroupedProviderRaw | null | undefined
): GroupedAggregationConflict | null => {
  if (!raw) return null;
  if (
    raw.openai.length > 1 ||
    raw.claude.length > 1 ||
    raw.codex.length > 1 ||
    raw.gemini.length > 1
  ) {
    return 'multiple-configs';
  }

  const openAIKeyCount = raw.openai.reduce(
    (count, item) =>
      count + (item.config.apiKeyEntries ?? []).filter((entry) => entry.apiKey?.trim()).length,
    0
  );
  return openAIKeyCount > 1 ? 'multiple-openai-keys' : null;
};

export const getGroupedProviderDefinition = (
  brand: GroupedProviderBrand
): GroupedProviderDefinition => GROUPED_DEFINITIONS[brand];

export const groupedProtocolI18nKey = (
  protocol: GroupedProtocol
): 'openai' | 'codexResponses' | 'anthropic' | 'gemini' => {
  if (protocol === 'claude') return 'anthropic';
  if (protocol === 'codex') return 'codexResponses';
  return protocol;
};

export const groupedProtocolModelI18nKey = (
  protocol: GroupedProtocol
): 'openai' | 'codex' | 'anthropic' | 'gemini' => {
  if (protocol === 'claude') return 'anthropic';
  return protocol;
};

export const discoveryBrandForGroupedProtocol = (protocol: GroupedProtocol): ProviderBrand =>
  protocol === 'openai' ? 'openaiCompatibility' : protocol;

export const groupedProtocolUrl = (urls: GroupedProtocolUrls, protocol: GroupedProtocol): string => {
  if (protocol === 'claude') return urls.anthropic;
  if (protocol === 'codex') return urls.codex;
  if (protocol === 'gemini') return urls.gemini;
  return urls.openai;
};
