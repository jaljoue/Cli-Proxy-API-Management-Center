import type { BuiltInOAuthProvider } from '@/services/api';
import { getPluginTitle } from '@/features/plugins/pluginResources';
import { resolvePluginLogo } from '@/features/plugins/pluginLogos';
import type { PluginListEntry } from '@/types';
import iconMeta from '@/assets/icons/meta.svg';
import iconCodex from '@/assets/icons/codex.svg';
import iconClaude from '@/assets/icons/claude.svg';
import iconAntigravity from '@/assets/icons/antigravity.svg';
// Tile icon: inset the K and blue dot proportionally so the dot stays inside the corners.
import iconKimiTileBlack from '@/assets/icons/kimi-tile-black.svg';
import iconKimiTileWhite from '@/assets/icons/kimi-tile-white.svg';
import iconGrok from '@/assets/icons/grok.svg';
import iconGrokDark from '@/assets/icons/grok-dark.svg';
import iconDevin from '@/assets/icons/devin.svg';
import iconDevinDark from '@/assets/icons/devin-dark.svg';

export type ThemedIcon = string | { light: string; dark: string };

/** Device-code flows return user_code; browser flows use automatic local or pasted remote
 * callbacks. */
export type OAuthFlowKind = 'device' | 'browser';

export interface BuiltInOAuthProviderCard {
  kind: 'builtin';
  id: BuiltInOAuthProvider;
  /** Short tile name: constant brand names match dashboard providerLabel; regional sites use
   * i18n. */
  label: string | { key: string };
  /** Dialog title, reusing auth_login.<id>_oauth_title. */
  titleKey: string;
  icon: ThemedIcon;
  flow: OAuthFlowKind;
  /** Distinguish sites of the same brand in the tile's secondary line. */
  domain?: string;
}

export interface PluginOAuthProviderCard {
  kind: 'plugin';
  id: string;
  title: string;
  icon: string;
}

export type OAuthProviderCard = BuiltInOAuthProviderCard | PluginOAuthProviderCard;

/** Display order follows array order. */
export const OAUTH_PROVIDERS: BuiltInOAuthProviderCard[] = [
  {
    kind: 'builtin',
    id: 'meta',
    label: 'Muse (Meta)',
    titleKey: 'auth_login.meta_oauth_title',
    icon: iconMeta,
    flow: 'device',
  },
  {
    kind: 'builtin',
    id: 'codex',
    label: 'Codex',
    titleKey: 'auth_login.codex_oauth_title',
    icon: iconCodex,
    flow: 'browser',
  },
  {
    kind: 'builtin',
    id: 'anthropic',
    label: 'Claude',
    titleKey: 'auth_login.anthropic_oauth_title',
    icon: iconClaude,
    flow: 'browser',
  },
  {
    kind: 'builtin',
    id: 'antigravity',
    label: 'Antigravity',
    titleKey: 'auth_login.antigravity_oauth_title',
    icon: iconAntigravity,
    flow: 'browser',
  },
  {
    kind: 'builtin',
    id: 'xai',
    label: 'xAI',
    titleKey: 'auth_login.xai_oauth_title',
    icon: { light: iconGrok, dark: iconGrokDark },
    flow: 'browser',
  },
  {
    kind: 'builtin',
    id: 'devin',
    label: 'Devin',
    titleKey: 'auth_login.devin_oauth_title',
    icon: { light: iconDevin, dark: iconDevinDark },
    flow: 'browser',
  },
  {
    kind: 'builtin',
    id: 'kimi',
    label: { key: 'auth_login.kimi_oauth_name' },
    titleKey: 'auth_login.kimi_oauth_title',
    icon: { light: iconKimiTileBlack, dark: iconKimiTileWhite },
    flow: 'device',
    domain: 'kimi.com',
  },
  {
    kind: 'builtin',
    id: 'kimi-ai',
    label: { key: 'auth_login.kimi_ai_oauth_name' },
    titleKey: 'auth_login.kimi_ai_oauth_title',
    icon: { light: iconKimiTileBlack, dark: iconKimiTileWhite },
    flow: 'device',
    domain: 'kimi.ai',
  },
];

const BUILTIN_PROVIDER_IDS = new Set<string>(OAUTH_PROVIDERS.map((provider) => provider.id));

/** Built-in providers accepting manual callbacks; plugin providers are always allowed. */
export const CALLBACK_SUPPORTED = new Set<string>([
  'codex',
  'anthropic',
  'antigravity',
  'xai',
  'devin',
]);

export const supportsManualCallback = (provider: OAuthProviderCard): boolean =>
  provider.kind === 'plugin' || CALLBACK_SUPPORTED.has(provider.id);

export const resolveThemedIcon = (icon: ThemedIcon, theme: 'light' | 'dark'): string =>
  typeof icon === 'string' ? icon : icon[theme];

export const buildPluginOAuthProviderCards = (
  plugins: PluginListEntry[],
  apiBase: string
): PluginOAuthProviderCard[] => {
  const seenProviders = new Set(BUILTIN_PROVIDER_IDS);
  return plugins.flatMap((plugin) => {
    const provider = plugin.oauthProvider;
    if (
      !plugin.supportsOAuth ||
      !plugin.effectiveEnabled ||
      !provider ||
      seenProviders.has(provider)
    ) {
      return [];
    }
    seenProviders.add(provider);
    return [
      {
        kind: 'plugin' as const,
        id: provider,
        title: getPluginTitle(plugin),
        icon: resolvePluginLogo(plugin.id, plugin.logo || plugin.metadata?.logo || '', apiBase),
      },
    ];
  });
};
