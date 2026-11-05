import { afterEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { createInstance } from 'i18next';
import en from '@/i18n/locales/en.json';
import ru from '@/i18n/locales/ru.json';
import { VaultHeader } from '@/features/authFiles/components/VaultHeader';
import { deriveAuthFileIdentity, maskAuthFileIdentity } from '@/features/authFiles/identity';
import { presentCredentialName, useEmailMaskStore } from '@/stores';
import { credentialIdentityLabel } from '@/utils/credentialMask';
import type { AuthFileItem } from '@/types';

const codexFile: AuthFileItem = {
  name: 'codex-ae5d455f-first.last@example.dev-pro.json',
  type: 'codex',
  email: 'first.last@example.dev',
};

afterEach(() => {
  useEmailMaskStore.setState({ maskEmails: true });
});

describe('maskAuthFileIdentity', () => {
  test('masks the account line, secondary file name and full name', () => {
    const identity = maskAuthFileIdentity(deriveAuthFileIdentity(codexFile), codexFile.email, true);
    expect(identity).toEqual({
      kind: 'email',
      primary: 'f•••@e•••.dev',
      secondary: 'codex-ae5d455f-f•••@e•••.dev-pro',
      fullName: 'codex-ae5d455f-f•••@e•••.dev-pro.json',
    });
    expect(JSON.stringify(identity)).not.toContain('first.last');
  });

  test('covers a hyphenated local part exactly when the backend supplies the email', () => {
    const file: AuthFileItem = {
      name: 'codex-abc12345-first-last@example.com-team.json',
      type: 'codex',
      email: 'first-last@example.com',
    };
    const identity = maskAuthFileIdentity(deriveAuthFileIdentity(file), file.email, true);
    expect(identity.secondary).toBe('codex-abc12345-f•••@e•••.com-team');
    expect(identity.fullName).not.toContain('last@');
  });

  test('masks emails embedded in file-name-only identities', () => {
    const file: AuthFileItem = { name: 'antigravity-user@example.com.json', type: 'antigravity' };
    const identity = maskAuthFileIdentity(deriveAuthFileIdentity(file), file.email, true);
    expect(identity.kind).toBe('fileName');
    expect(identity.primary).toBe('antigravity-u•••@e•••.com');
  });

  test('leaves project IDs readable and returns the identity untouched when revealed', () => {
    const file: AuthFileItem = { name: 'vertex-proj.json', type: 'vertex', projectId: 'my-proj' };
    const masked = maskAuthFileIdentity(deriveAuthFileIdentity(file), undefined, true);
    expect(masked.primary).toBe('my-proj');
    const plain = deriveAuthFileIdentity(codexFile);
    expect(maskAuthFileIdentity(plain, codexFile.email, false)).toBe(plain);
  });
});

describe('shared email mask preference', () => {
  test('defaults to masked and drives transient credential names', () => {
    expect(useEmailMaskStore.getState().maskEmails).toBe(true);
    expect(presentCredentialName(codexFile.name, codexFile.email)).toBe(
      'codex-ae5d455f-f•••@e•••.dev-pro.json'
    );
    useEmailMaskStore.getState().toggleMaskEmails();
    expect(presentCredentialName(codexFile.name, codexFile.email)).toBe(codexFile.name);
  });

  test('labels multi-identity quota rows without exposing an address', () => {
    expect(
      credentialIdentityLabel({
        name: 'devin.json',
        email: 'dev@example.com',
        authIndex: '3',
        maskEmails: true,
      })
    ).toBe('d•••@e•••.com · devin.json');
    expect(credentialIdentityLabel({ name: 'devin.json', authIndex: '3', maskEmails: true })).toBe(
      'devin.json · 3'
    );
  });
});

describe('VaultHeader email toggle', () => {
  const render = async (lng: 'en' | 'ru', maskEmails: boolean) => {
    const i18n = createInstance();
    await i18n.init({ lng, resources: { [lng]: { translation: lng === 'en' ? en : ru } } });
    const markup = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(VaultHeader, {
          totalCount: 2,
          activeCount: 2,
          problemCount: 0,
          loading: false,
          refreshing: false,
          uploading: false,
          disableControls: false,
          onUpload: () => {},
          onRefresh: () => {},
          maskEmails,
          onToggleMaskEmails: () => {},
        })
      )
    );
    return { i18n, markup };
  };

  for (const lng of ['en', 'ru'] as const) {
    test(`offers a localized, pressed-state toggle (${lng})`, async () => {
      const masked = await render(lng, true);
      expect(masked.markup).toContain('aria-pressed="false"');
      expect(masked.markup).toContain(masked.i18n.t('auth_files.show_emails'));
      expect(masked.markup).not.toContain('auth_files.');
      const shown = await render(lng, false);
      expect(shown.markup).toContain('aria-pressed="true"');
      expect(shown.markup).toContain(shown.i18n.t('auth_files.hide_emails'));
    });
  }
});
