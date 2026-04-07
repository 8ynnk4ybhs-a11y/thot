import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Comprueba si el identificador (email) ha superado el límite de intentos.
 * Devuelve `allowed: false` y `resetIn` (segundos restantes) si está bloqueado.
 */
export async function checkRateLimit(
  identifier: string
): Promise<{ allowed: boolean; resetIn: number }> {
  const key = `thot_rl:${identifier}`;
  try {
    const raw = await AsyncStorage.getItem(key);
    const now = Date.now();

    if (!raw) {
      await AsyncStorage.setItem(key, JSON.stringify({ attempts: 1, firstAttempt: now }));
      return { allowed: true, resetIn: 0 };
    }

    const { attempts, firstAttempt } = JSON.parse(raw) as { attempts: number; firstAttempt: number };
    const elapsed = now - firstAttempt;

    if (elapsed > WINDOW_MS) {
      await AsyncStorage.setItem(key, JSON.stringify({ attempts: 1, firstAttempt: now }));
      return { allowed: true, resetIn: 0 };
    }

    if (attempts >= MAX_ATTEMPTS) {
      const resetIn = Math.ceil((WINDOW_MS - elapsed) / 1000);
      return { allowed: false, resetIn };
    }

    await AsyncStorage.setItem(key, JSON.stringify({ attempts: attempts + 1, firstAttempt }));
    return { allowed: true, resetIn: 0 };
  } catch {
    // Si falla el storage, dejamos pasar (fail open)
    return { allowed: true, resetIn: 0 };
  }
}
