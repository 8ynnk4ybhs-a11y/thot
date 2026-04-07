/**
 * Cliente Supabase para Thot.
 * La clave anon (publishable) es pública por diseño — solo tiene los permisos
 * que definan las políticas RLS. Los tokens se guardan en AsyncStorage
 * (los JWT de Supabase superan el límite de 2KB de SecureStore en iOS).
 */

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vfpnasiikvskcmejncxn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_dHUUwY0etyRcNzWJavIDUA_ou8Q0GJw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
