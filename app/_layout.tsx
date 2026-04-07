import AsyncStorage from '@react-native-async-storage/async-storage';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

const thotTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#000000',
    card: '#000000',
    text: '#ffffff',
    border: '#1a1a1a',
    primary: '#ffffff',
  },
};

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => {
        setSession(data.session ?? null);
      })
      .catch(() => {
        setSession(null);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Aún cargando sesión — no redirigir todavía
    if (session === undefined) return;

    const inTabs = segments[0] === '(tabs)';
    const inRoot = segments.length === 0 || segments[0] === 'index' || segments[0] === undefined;

    // Sin sesión intentando acceder a tabs → login
    if (!session && inTabs) {
      router.replace('/');
      return;
    }

    // Con sesión activa en la raíz → redirigir a tabs, salvo que haya onboarding pendiente
    if (session && inRoot) {
      (async () => {
        const pending = await AsyncStorage.getItem('thot_onboarding_pending');
        if (!pending) {
          router.replace('/(tabs)');
        }
      })();
    }
  }, [session, segments]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={thotTheme}>
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="nueva-historia"
            options={{ headerShown: false, presentation: 'modal' }}
          />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
