import {
  WEBDAV_RESTORE_RECOMMENDATION_AUTO_PROMPTED_SESSION_KEY,
  WEBDAV_RESTORE_RECOMMENDATION_INIT_SESSION_KEY,
  WEBDAV_RESTORE_RECOMMENDATION_PENDING_SESSION_KEY,
} from './constants';
import { normalizeDavPath, normalizeServerUrl } from './utils';

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getRestoreRecommendationStorageKey(baseKey: string, scope: string): string {
  return `${baseKey}:${scope}`;
}

export function buildConnectionScope(serverUrl: string, basePath: string, username: string): string {
  if (!serverUrl) {
    return '';
  }

  return `${normalizeServerUrl(serverUrl)}::${normalizeDavPath(basePath)}::${username.trim()}`;
}

export function ensureRestoreRecommendationPending(scope: string): boolean {
  if (!scope) return false;

  const storage = getSessionStorage();
  if (!storage) return false;

  const initKey = getRestoreRecommendationStorageKey(
    WEBDAV_RESTORE_RECOMMENDATION_INIT_SESSION_KEY,
    scope,
  );
  const pendingKey = getRestoreRecommendationStorageKey(
    WEBDAV_RESTORE_RECOMMENDATION_PENDING_SESSION_KEY,
    scope,
  );

  const initialized = storage.getItem(initKey) === '1';
  if (!initialized) {
    storage.setItem(initKey, '1');
    storage.setItem(pendingKey, '1');
    return true;
  }

  return storage.getItem(pendingKey) === '1';
}

export function isRestoreRecommendationPending(scope: string): boolean {
  if (!scope) return false;

  const storage = getSessionStorage();
  if (!storage) return false;

  const pendingKey = getRestoreRecommendationStorageKey(
    WEBDAV_RESTORE_RECOMMENDATION_PENDING_SESSION_KEY,
    scope,
  );

  return storage.getItem(pendingKey) === '1';
}

export function clearRestoreRecommendationPending(scope: string): void {
  if (!scope) return;

  const storage = getSessionStorage();
  if (!storage) return;

  const pendingKey = getRestoreRecommendationStorageKey(
    WEBDAV_RESTORE_RECOMMENDATION_PENDING_SESSION_KEY,
    scope,
  );
  storage.removeItem(pendingKey);
}

export function hasRestoreRecommendationAutoPrompted(scope: string): boolean {
  if (!scope) return false;

  const storage = getSessionStorage();
  if (!storage) return false;

  const key = getRestoreRecommendationStorageKey(
    WEBDAV_RESTORE_RECOMMENDATION_AUTO_PROMPTED_SESSION_KEY,
    scope,
  );

  return storage.getItem(key) === '1';
}

export function markRestoreRecommendationAutoPrompted(scope: string): void {
  if (!scope) return;

  const storage = getSessionStorage();
  if (!storage) return;

  const key = getRestoreRecommendationStorageKey(
    WEBDAV_RESTORE_RECOMMENDATION_AUTO_PROMPTED_SESSION_KEY,
    scope,
  );
  storage.setItem(key, '1');
}
