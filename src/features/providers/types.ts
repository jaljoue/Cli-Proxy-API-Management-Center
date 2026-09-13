/**
 * AI provider workbench view model (normalizes each brand's heterogeneous config).
 */

import type { GeminiKeyConfig, OpenAIProviderConfig, ProviderKeyConfig } from '@/types';
import type { ThinkingLevel } from './thinkingLevels';

export type ProviderBrand =
  | 'gemini'
  | 'interactions'
  | 'codex'
  | 'xai'
  | 'claude'
  | 'vertex'
  | 'openaiCompatibility'
  | 'kimi';

/** Brands whose one credential is persisted across several protocol configs. */
export type GroupedProviderBrand = 'kimi';

export const PROVIDER_SORT_BY_VALUES = ['name', 'priority', 'recent-success'] as const;
export type ProviderSortBy = (typeof PROVIDER_SORT_BY_VALUES)[number];

export const SORT_DIR_VALUES = ['asc', 'desc'] as const;
export type SortDir = (typeof SORT_DIR_VALUES)[number];

export type ProviderResourceSelector =
  | { brand: 'gemini'; apiKey: string; baseUrl?: string; index: number }
  | { brand: 'interactions'; apiKey: string; baseUrl?: string; index: number }
  | { brand: 'codex'; apiKey: string; baseUrl?: string; index: number }
  | { brand: 'xai'; apiKey: string; baseUrl?: string; index: number }
  | { brand: 'claude'; apiKey: string; baseUrl?: string; index: number }
  | { brand: 'vertex'; apiKey: string; baseUrl?: string; index: number }
  | { brand: 'openaiCompatibility'; name: string; index: number }
  | {
      brand: 'kimi';
      openaiIndices: number[];
      claudeIndices: number[];
      codexIndices: number[];
      geminiIndices: number[];
    };

export interface ProviderResourceFlags {
  cloakEnabled?: boolean;
  claudeCodeCliProfile?: boolean;
  websockets?: boolean;
  protocols?: string[];
}

export interface ProviderResource {
  /** Stable id, used as the React key and for selection checks */
  id: string;
  brand: ProviderBrand;
  /** Index in the original array */
  originalIndex: number;
  /** Display name for the table key column (OpenAI=name, others=null) */
  name: string | null;
  /** Fallback display text (masked API key or fallback) */
  identifier: string;
  /** Masked apiKey preview, for display */
  apiKeyPreview: string | null;
  /** Real apiKey for the selector; OpenAI returns null here because of multiple keys */
  apiKey: string | null;
  authIndex: string | null;
  baseUrl: string | null;
  proxyUrl: string | null;
  prefix: string | null;
  modelCount: number;
  /** Deduplicated model names, for filtering/search */
  models: string[];
  /** Sort priority, 0 when not configured */
  priority: number;
  headerCount: number;
  excludedModelCount: number;
  /** Only meaningful for OpenAI; other brands keep the field but do not show it */
  apiKeyEntryCount: number;
  /** Whether disabled (each brand has its own rule) */
  disabled: boolean;
  /** Extra capability flags */
  flags: ProviderResourceFlags;
  /** Selector used for delete/update */
  selector: ProviderResourceSelector;
  /** Original raw config, used to initialize the Sheet form */
  raw: unknown;
}

export interface ProviderGroup {
  id: ProviderBrand;
  resources: ProviderResource[];
}

export interface ProviderSnapshot {
  fetchedAt: string;
  groups: ProviderGroup[];
}

export interface GroupedProviderRaw {
  openai: Array<{ config: OpenAIProviderConfig; index: number }>;
  claude: Array<{ config: ProviderKeyConfig; index: number }>;
  codex: Array<{ config: ProviderKeyConfig; index: number }>;
  gemini: Array<{ config: GeminiKeyConfig; index: number }>;
}

/**
 * Shared sheet form values.
 * Gemini/Codex/Claude/Vertex/OpenAI share the base fields and enable their own advanced sections.
 */
export interface ModelEntryInput {
  name: string;
  alias?: string;
  priority?: number;
  testModel?: string;
  image?: boolean;
  /** Original backend value, preserved until the standard-level selector is changed. */
  thinkingJson?: string;
  thinkingLevels?: ThinkingLevel[];
  thinkingLevelsTouched?: boolean;
}

export type GroupedProtocol = 'openai' | 'codex' | 'claude' | 'gemini';

export interface GroupedKeyEntryInput {
  protocol: GroupedProtocol;
  apiKey: string;
  existingApiKey?: string;
  baseUrl: string;
  proxyUrl: string;
  prefix: string;
  disabled: boolean;
  disableCooling?: boolean;
  priority?: number;
  weight?: number;
  models: ModelEntryInput[];
}

export interface ApiKeyEntryInput {
  apiKey: string;
  existingApiKey?: string;
  proxyUrl: string;
  weight?: number;
  authIndex?: string;
}

export interface CloakInput {
  mode: string;
  strictMode: boolean;
  sensitiveWordsText: string;
  cacheUserId: boolean;
}

export interface ProviderEntryFormInput {
  /** On OpenAI create, passed only via apiKeyEntries */
  apiKey: string;
  /** Required for OpenAI; not shown for other brands */
  name: string;
  baseUrl: string;
  proxyUrl: string;
  prefix: string;
  disabled: boolean;
  disableCooling?: boolean;
  priority?: number;
  weight?: number;

  /** Advanced collapsible section */
  models: ModelEntryInput[];
  headers: Array<{ key: string; value: string }>;
  excludedModelsText: string;

  /** Codex only */
  websockets?: boolean;
  /** Claude only */
  cloak?: CloakInput;
  fingerprintProfile?: string;
  /** OpenAI persists this; Gemini/Claude use it for one-off connectivity tests. */
  testModel?: string;
  apiKeyEntries?: ApiKeyEntryInput[];
  /** Grouped brands store one key per platform protocol. */
  groupedKeyEntries?: GroupedKeyEntryInput[];
}
