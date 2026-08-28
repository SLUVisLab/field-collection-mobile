/**
 * Gather credential policy over SecureStore — PURE key logic with an injected
 * store adapter (no `expo-*` imports here).
 *
 * This layer exists to own three invariants that must not be scattered through
 * the app:
 *   - SecureStore key naming (Gather namespace + project scoping);
 *   - the credential lifecycle for a project (set / get / delete);
 *   - the rule that secrets live ONLY in SecureStore, never in SQLite or files.
 *
 * The actual `expo-secure-store` binding is injected via `createCredentialStore`
 * so this module is unit-testable in Node; `index.js` wires the real adapter.
 */

import { assertProjectKey } from './paths.js';

export const SECURE_STORE_NAMESPACE = 'gather';

export class CredentialError extends Error {
  constructor(message, { code = 'GATHER_CREDENTIAL_ERROR', details = null } = {}) {
    super(message);
    this.name = 'CredentialError';
    this.code = code;
    this.details = details;
  }
}

/**
 * SecureStore keys may only contain `[A-Za-z0-9._-]`. Project keys already
 * satisfy this (see `assertProjectKey`), so the namespaced key is inherently
 * valid without further escaping.
 */
export const projectTokenKey = (projectKey) =>
  `${SECURE_STORE_NAMESPACE}.project.${assertProjectKey(projectKey)}.appUserToken`;

/**
 * Every SecureStore key owned for a project. Extend this as new secret kinds are
 * added; `deleteProjectCredentials()` removes all of them.
 */
export const projectCredentialKeys = (projectKey) => [projectTokenKey(projectKey)];

const assertToken = (token) => {
  if (typeof token !== 'string' || token.length === 0) {
    throw new CredentialError('token must be a non-empty string', {
      code: 'GATHER_CREDENTIAL_INVALID',
    });
  }
  return token;
};

/**
 * Create a Gather credential store over a SecureStore-like adapter.
 *
 * @param {{
 *   setItemAsync: (key: string, value: string) => Promise<void>,
 *   getItemAsync: (key: string) => Promise<string | null>,
 *   deleteItemAsync: (key: string) => Promise<void>,
 * }} store
 */
export const createCredentialStore = (store) => {
  if (
    !store ||
    typeof store.setItemAsync !== 'function' ||
    typeof store.getItemAsync !== 'function' ||
    typeof store.deleteItemAsync !== 'function'
  ) {
    throw new CredentialError('createCredentialStore requires a SecureStore-like adapter', {
      code: 'GATHER_CREDENTIAL_NO_STORE',
    });
  }

  return {
    /** Store the Central App User token for a project. */
    async setProjectToken(projectKey, token) {
      await store.setItemAsync(projectTokenKey(projectKey), assertToken(token));
    },
    /** Read the Central App User token for a project (or `null` if absent). */
    async getProjectToken(projectKey) {
      return store.getItemAsync(projectTokenKey(projectKey));
    },
    /**
     * Remove all credentials for a project. Because iOS Keychain values can
     * survive an app uninstall/reinstall, project removal must call this
     * explicitly. Returns the number of keys removed.
     */
    async deleteProjectCredentials(projectKey) {
      const keys = projectCredentialKeys(projectKey);
      await Promise.all(keys.map((key) => store.deleteItemAsync(key)));
      return keys.length;
    },
  };
};
