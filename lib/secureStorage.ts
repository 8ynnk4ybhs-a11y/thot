/**
 * Wrapper sobre expo-secure-store para datos sensibles (tokens de sesión,
 * conversaciones privadas con la IA).
 *
 * SecureStore usa Keychain (iOS) / Keystore (Android) — cifrado a nivel de SO.
 * Limitación: máx ~2 KB por clave. Para datos grandes usamos AsyncStorage
 * con una clave de cifrado guardada en SecureStore (pendiente implementar).
 */

import * as SecureStore from 'expo-secure-store';

export const SecureKeys = {
  SESSION:       'thot_session',
  THOT_CONVOS:   'thot_convos_secure',
} as const;

/** Guarda un valor cifrado. */
export async function setSecure(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

/** Lee un valor cifrado. Devuelve null si no existe o hay error. */
export async function getSecure(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

/** Elimina un valor cifrado. */
export async function deleteSecure(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {}
}
