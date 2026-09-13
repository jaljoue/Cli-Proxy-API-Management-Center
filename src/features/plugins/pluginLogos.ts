/**
 * Bundled logo fallbacks for plugins that ship without one.
 *
 * The backend serves `logo` from plugin metadata; when a plugin leaves it
 * empty the sidebar, plugin list and store fall back to a generic plug glyph.
 * For plugins whose provider already has a brand asset in this bundle, use it
 * instead so the plugin reads like every other provider in the UI.
 *
 * Bundled assets are returned as-is (Vite inlines them as data URLs in the
 * single-file build and serves them from its own origin in dev), so they must
 * never be routed through `resolvePluginAssetURL`, which prefixes the API base.
 */

import opencodeLogo from '@/assets/icons/opencode.svg';
import { resolvePluginAssetURL } from './pluginResources';

const KNOWN_PLUGIN_LOGOS: Record<string, string> = {
  'opencode-go-cliproxyapi': opencodeLogo,
};

/** Backend logo resolved against the API base when present, otherwise a bundled fallback. */
export const resolvePluginLogo = (
  pluginId: string,
  backendLogo: string,
  apiBase: string
): string => {
  const trimmed = backendLogo.trim();
  if (trimmed) return resolvePluginAssetURL(trimmed, apiBase);
  return KNOWN_PLUGIN_LOGOS[pluginId.trim().toLowerCase()] ?? '';
};
