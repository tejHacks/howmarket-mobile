/**
 * The sign-in token lives in the phone's secure storage (iOS Keychain, Android
 * Keystore-backed), never in AsyncStorage. On web there is no secure store, so
 * the token stays in memory for the session only.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'howmarket.token';
const native = Platform.OS !== 'web';
let cached: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (cached !== undefined) return cached;
  cached = native ? await SecureStore.getItemAsync(KEY).catch(() => null) : null;
  return cached;
}

export async function setToken(token: string) {
  cached = token;
  if (native) await SecureStore.setItemAsync(KEY, token, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
}

export async function clearToken() {
  cached = null;
  if (native) await SecureStore.deleteItemAsync(KEY).catch(() => {});
}

/** Test helper. */
export function resetTokenCache() {
  cached = undefined;
}
