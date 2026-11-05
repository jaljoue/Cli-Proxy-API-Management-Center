/**
 * Screen-share safe credential names, shared by the quota and auth files pages.
 *
 * Emails are masked by default in every new browser session; revealing them is an explicit
 * action and lasts only for the session (sessionStorage), so a fresh tab never starts with
 * addresses on screen. Toggling on either page applies to both.
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { maskCredentialName } from '@/utils/credentialMask';

export const EMAIL_MASK_STORAGE_KEY = 'cli-proxy-email-mask';

interface EmailMaskState {
  maskEmails: boolean;
  setMaskEmails: (maskEmails: boolean) => void;
  toggleMaskEmails: () => void;
}

const sessionStorageOrMemory = () => {
  if (typeof window !== 'undefined' && window.sessionStorage) return window.sessionStorage;
  const memory = new Map<string, string>();
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
    removeItem: (key: string) => void memory.delete(key),
  };
};

export const useEmailMaskStore = create<EmailMaskState>()(
  persist(
    (set) => ({
      maskEmails: true,
      setMaskEmails: (maskEmails) => set({ maskEmails }),
      toggleMaskEmails: () => set((state) => ({ maskEmails: !state.maskEmails })),
    }),
    {
      name: EMAIL_MASK_STORAGE_KEY,
      storage: createJSONStorage(sessionStorageOrMemory),
      partialize: (state) => ({ maskEmails: state.maskEmails }),
    }
  )
);

/**
 * Credential file name as it should appear in transient UI (toasts, confirmations) under the
 * current preference. Reads the store imperatively so event handlers need no subscription.
 */
export const presentCredentialName = (name: string, email?: string | null): string =>
  useEmailMaskStore.getState().maskEmails ? maskCredentialName(name, email) : name;
