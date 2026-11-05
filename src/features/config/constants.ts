import type { ComponentType } from 'react';
import {
  IconCode,
  IconKey,
  IconNetwork,
  IconSatellite,
  IconScrollText,
  IconShield,
  IconSlidersHorizontal,
  type IconProps,
} from '@/components/ui/icons';
import type { VisualConfigFieldPath } from '@/types/visualConfig';
import type { VisualSectionId } from './searchIndex';

/** Edit mode: visual form or YAML source. */
export type ConfigEditorMode = 'visual' | 'source';

/** 顶部 tabs：'common'（常用，原简单模式的继任者）+ 6 个正典分区。 */
export type ConfigTabId = 'common' | VisualSectionId;

export const CONFIG_SECTION_IDS = [
  'connectivity',
  'network',
  'logging',
  'streaming',
  'advanced',
  'payload',
] as const satisfies readonly VisualSectionId[];

export const CONFIG_TAB_IDS: readonly ConfigTabId[] = ['common', ...CONFIG_SECTION_IDS];

/** 分区序号（01–06）。常用 tab 是别名视图，不占序号。 */
export const SECTION_INDEX_LABELS: Record<VisualSectionId, string> = {
  connectivity: '01',
  network: '02',
  logging: '03',
  streaming: '04',
  advanced: '05',
  payload: '06',
};

export const CONFIG_TAB_ICONS: Record<ConfigTabId, ComponentType<IconProps>> = {
  common: IconSlidersHorizontal,
  connectivity: IconKey,
  network: IconNetwork,
  logging: IconScrollText,
  streaming: IconSatellite,
  advanced: IconShield,
  payload: IconCode,
};

/** 常用 tab 的 6 个字段（原简单模式），渲染源与正典分区共享（fields/sharedFields.tsx）。 */
export const COMMON_FIELD_IDS = [
  'host',
  'port',
  'apiKeys',
  'proxyUrl',
  'debug',
  'loggingToFile',
] as const;

/**
 * Validation field paths carried by each section (bucketing basis for tab error badges).
 * Payload validation does not go through field paths; the hasPayloadValidationErrors flag
 * covers it.
 */
export const SECTION_VALIDATION_FIELDS: Record<VisualSectionId, readonly VisualConfigFieldPath[]> =
  {
    connectivity: ['port', 'trustedProxies', 'discoveryServiceType'],
    network: [
      'requestRetry',
      'maxRetryCredentials',
      'maxRetryInterval',
      'authAutoRefreshWorkers',
      'transientErrorCooldownSeconds',
      'videoResultAuthCacheTTL',
    ],
    logging: ['errorLogsMaxFiles', 'logsMaxTotalSizeMb', 'redisUsageQueueRetentionSeconds'],
    streaming: [
      'streaming.keepaliveSeconds',
      'streaming.bootstrapRetries',
      'streaming.nonstreamKeepaliveInterval',
    ],
    advanced: [
      'claudeHeaderTimezone',
      'codexStreamBootstrapTimeout',
      'antigravityConnectionPoolIdleTimeout',
      'antigravityConnectionPoolMaxIdleConnsPerHost',
      'codexLiveMediaRelayMaxSessions',
      'codexLiveMediaRelayPublicIP',
      'codexLiveMediaRelayUDPPortMin',
      'codexLiveMediaRelayUDPPortMax',
      'codexLiveMediaRelayICEServers',
    ],
    payload: [],
  };

/**
 * fieldId → useVisualConfig dirtyFields 的键（= VisualConfigValues 叶值键，streaming 用点号叶）。
 * 与搜索索引一一对应；三方对账由 tests/configFieldParity.test.ts 守护 ——
 * 增删字段时漏改任何一边（索引 / 本表 / 分区 JSX）都会红。
 */
export const FIELD_VALUE_KEYS: Record<string, readonly string[]> = {
  routingSessionAffinitySubagents: ['routingSessionAffinitySubagents'],
  saveCooldownStatus: ['saveCooldownStatus'],
  transientErrorCooldownSeconds: ['transientErrorCooldownSeconds'],
  videoResultAuthCacheTTL: ['videoResultAuthCacheTTL'],
  claudeHeaderTimezone: ['claudeHeaderTimezone'],
  claudeModelLevelCooling: ['claudeModelLevelCooling'],
  claudeDisableCloakMode: ['claudeDisableCloakMode'],
  claudeCodeDisableCloakingModelList: ['claudeCodeDisableCloakingModelList'],
  codexDisableCloaking: ['codexDisableCloaking'],
  codexModelLevelCooling: ['codexModelLevelCooling'],
  codexStreamBootstrapBuffering: ['codexStreamBootstrapBuffering'],
  codexStreamBootstrapTimeout: ['codexStreamBootstrapTimeout'],
  codexOptimizeMultiAgentV2: ['codexOptimizeMultiAgentV2'],
  codexOrphanDelegationCompatibility: ['codexOrphanDelegationCompatibility'],
  codexResponseSteering: ['codexResponseSteering'],
  antigravityConnectionPoolEnabled: ['antigravityConnectionPoolEnabled'],
  antigravityConnectionPoolIdleTimeout: ['antigravityConnectionPoolIdleTimeout'],
  antigravityConnectionPoolMaxIdleConnsPerHost: ['antigravityConnectionPoolMaxIdleConnsPerHost'],
  xaiInjectXSearch: ['xaiInjectXSearch'],
  codexLiveMediaRelayEnabled: ['codexLiveMediaRelayEnabled'],
  codexLiveMediaRelayMaxSessions: ['codexLiveMediaRelayMaxSessions'],
  codexLiveMediaRelayDisablePrivateRemoteIPs: ['codexLiveMediaRelayDisablePrivateRemoteIPs'],
  codexLiveMediaRelayPublicIP: ['codexLiveMediaRelayPublicIP'],
  codexLiveMediaRelayUDPPortMin: ['codexLiveMediaRelayUDPPortMin'],
  codexLiveMediaRelayUDPPortMax: ['codexLiveMediaRelayUDPPortMax'],
  codexLiveMediaRelayICEServers: ['codexLiveMediaRelayICEServers'],

  // ── connectivity ──────────────────────────────────────────────────────────
  githubToken: ['githubToken'],
  trustedProxies: ['trustedProxies'],
  discoveryEnabled: ['discoveryEnabled'],
  discoveryServiceName: ['discoveryServiceName'],
  discoveryServiceType: ['discoveryServiceType'],
  discoverySubtypes: ['discoverySubtypes'],
  discoveryInterfacesInclude: ['discoveryInterfacesInclude'],
  discoveryInterfacesExclude: ['discoveryInterfacesExclude'],
  discoveryAuthRequired: ['discoveryAuthRequired'],
  discoveryAdvertiseManagement: ['discoveryAdvertiseManagement'],
  host: ['host'],
  port: ['port'],
  authDir: ['authDir'],
  apiKeys: ['apiKeysText'],
  tlsEnable: ['tlsEnable'],
  tlsCert: ['tlsCert'],
  tlsKey: ['tlsKey'],
  rmAllowRemote: ['rmAllowRemote'],
  rmDisableControlPanel: ['rmDisableControlPanel'],
  rmDisableAutoUpdatePanel: ['rmDisableAutoUpdatePanel'],
  rmSecretKey: ['rmSecretKey'],
  rmPanelRepo: ['rmPanelRepo'],
  // ── network ───────────────────────────────────────────────────────────────
  proxyUrl: ['proxyUrl'],
  requestRetry: ['requestRetry'],
  maxRetryCredentials: ['maxRetryCredentials'],
  maxRetryInterval: ['maxRetryInterval'],
  authAutoRefreshWorkers: ['authAutoRefreshWorkers'],
  routingStrategy: ['routingStrategy'],
  disableImageGeneration: ['disableImageGeneration'],
  gptImage2BaseModel: ['gptImage2BaseModel'],
  routingSessionAffinityTTL: ['routingSessionAffinityTTL'],
  forceModelPrefix: ['forceModelPrefix'],
  passthroughHeaders: ['passthroughHeaders'],
  disableCooling: ['disableCooling'],
  routingSessionAffinity: ['routingSessionAffinity'],
  wsAuth: ['wsAuth'],
  // ── logging ───────────────────────────────────────────────────────────────
  debug: ['debug'],
  commercialMode: ['commercialMode'],
  loggingToFile: ['loggingToFile'],
  logsMaxTotalSizeMb: ['logsMaxTotalSizeMb'],
  errorLogsMaxFiles: ['errorLogsMaxFiles'],
  redisUsageQueueRetentionSeconds: ['redisUsageQueueRetentionSeconds'],
  usageStatisticsEnabled: ['usageStatisticsEnabled'],
  // ── streaming ─────────────────────────────────────────────────────────────
  streamingKeepaliveSeconds: ['streaming.keepaliveSeconds'],
  streamingBootstrapRetries: ['streaming.bootstrapRetries'],
  streamingNonstreamKeepalive: ['streaming.nonstreamKeepaliveInterval'],
  // ── advanced ──────────────────────────────────────────────────────────────
  quotaAntigravityCredits: ['quotaAntigravityCredits'],
  pluginsEnabled: ['pluginsEnabled'],
  pluginStoreSources: ['pluginStoreSources'],
  pluginStoreAuth: ['pluginStoreAuth'],
  antigravitySensitiveWords: ['antigravitySensitiveWords'],
  devinSensitiveWords: ['devinSensitiveWords'],
  antigravitySignatureCacheEnabled: ['antigravitySignatureCacheEnabled'],
  antigravitySignatureBypassStrict: ['antigravitySignatureBypassStrict'],
  claudeHeaderUserAgent: ['claudeHeaderUserAgent'],
  claudeHeaderPackageVersion: ['claudeHeaderPackageVersion'],
  claudeHeaderRuntimeVersion: ['claudeHeaderRuntimeVersion'],
  claudeHeaderOs: ['claudeHeaderOs'],
  claudeHeaderArch: ['claudeHeaderArch'],
  claudeHeaderTimeout: ['claudeHeaderTimeout'],
  claudeHeaderStabilizeDeviceProfile: ['claudeHeaderStabilizeDeviceProfile'],
  codexHeaderUserAgent: ['codexHeaderUserAgent'],
  codexHeaderBetaFeatures: ['codexHeaderBetaFeatures'],
  // ── payload ───────────────────────────────────────────────────────────────
  payloadDefaultRules: ['payloadDefaultRules'],
  payloadDefaultRawRules: ['payloadDefaultRawRules'],
  payloadOverrideRules: ['payloadOverrideRules'],
  payloadOverrideRawRules: ['payloadOverrideRawRules'],
  payloadFilterRules: ['payloadFilterRules'],
};

/** DOM ids for tab / tabpanel: single definition; ConfigTabs and the page side panel use the
 * same function for aria links. */
export const configTabDomId = (id: ConfigTabId) => `config-tab-${id}`;
export const configPanelDomId = (id: ConfigTabId) => `config-panel-${id}`;

/** localStorage keys: mode keeps the old key ('visual' | 'source' domain unchanged); section
 * is a new key. */
export const CONFIG_MODE_STORAGE_KEY = 'config-management:tab';
export const CONFIG_SECTION_STORAGE_KEY = 'config-management:section';
/** Persistence key of the old "simple/full" dual mode; the mode axis is gone, cleaned up on
 * mount. */
export const LEGACY_EDITOR_MODE_STORAGE_KEY = 'config-management:editor-mode';
