import AsyncStorage from '@react-native-async-storage/async-storage';
import { BorradoresSchema, safeParse } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

const STORAGE_KEY = 'thot_borradores';

const GENRES = [
  'Terror', 'Fantasía', 'Romance', 'Ciencia ficción',
  'Misterio', 'Aventura', 'Drama', 'Histórica',
  'Poesía', 'Thriller', 'Comedia', 'Distopía',
];

type CapituloState = { id: string; contenido: string };

type Borrador = {
  id: string;
  titulo: string;
  sinopsis: string;
  capitulos: CapituloState[];
  genero?: string;
};

function createBorrador(): Borrador {
  return {
    id: Date.now().toString(),
    titulo: '',
    sinopsis: '',
    capitulos: [],
  };
}

// ─── Collapsed card (list view) ───────────────────────────────────────────────

function CollapsedCard({
  b,
  onDelete,
  onEnterFocus,
}: {
  b: Borrador;
  onDelete: () => void;
  onEnterFocus: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  function renderRightActions(progress: Animated.AnimatedInterpolation<number>) {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [80, 0],
    });
    return (
      <Animated.View style={[styles.deleteAction, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            swipeRef.current?.close();
            onDelete();
          }}>
          <MaterialIcons name="delete-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <View style={styles.card}>
        <TouchableOpacity activeOpacity={0.6} onPress={onEnterFocus}>
          <Text style={styles.tituloDisplay} numberOfLines={1}>
            {b.titulo || 'Sin título'}
          </Text>
        </TouchableOpacity>
        {!!b.sinopsis && (
          <Text style={styles.sinopsisDisplay} numberOfLines={3}>
            {b.sinopsis}
          </Text>
        )}
        <View style={styles.cardFooter}>
          <Text style={styles.capitulosCount}>
            {b.capitulos.length} {b.capitulos.length === 1 ? 'capítulo' : 'capítulos'}
          </Text>

          <TouchableOpacity style={styles.editarBtn} onPress={onEnterFocus}>
            <Text style={styles.editarText}>Editar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Swipeable>
  );
}

// ─── Expanded card (focus / edit view) ───────────────────────────────────────

function ExpandedCard({
  b,
  onUpdateTitulo,
  onUpdateSinopsis,
  onAddCapitulo,
  onRemoveCapitulo,
  onUpdateCapitulo,
}: {
  b: Borrador;
  onUpdateTitulo: (value: string) => void;
  onUpdateSinopsis: (value: string) => void;
  onAddCapitulo: () => void;
  onRemoveCapitulo: (capId: string) => void;
  onUpdateCapitulo: (capId: string, text: string) => void;
}) {
  const titleRef = useRef<TextInput>(null);
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const prevCapCount = useRef(b.capitulos.length);

  // Auto-focus title on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      titleRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (b.capitulos.length > prevCapCount.current) {
      const lastCap = b.capitulos[b.capitulos.length - 1];
      inputRefs.current[lastCap.id]?.focus();
    }
    prevCapCount.current = b.capitulos.length;
  }, [b.capitulos.length]);

  return (
    <View style={styles.card}>

      <TextInput
        ref={titleRef}
        style={styles.tituloInput}
        value={b.titulo}
        onChangeText={onUpdateTitulo}
        placeholder="Título"
        placeholderTextColor={Colors.textMuted}
        returnKeyType="next"
        maxLength={80}
      />

      <TextInput
        style={styles.sinopsisInput}
        value={b.sinopsis}
        onChangeText={onUpdateSinopsis}
        placeholder="Escribir"
        placeholderTextColor={Colors.textMuted}
        multiline
        textAlignVertical="top"
      />

      {b.capitulos.map((cap, cIndex) => (
        <View key={cap.id}>
          <View style={styles.capituloHeader}>
            <Text style={styles.capituloLabel}>CAPÍTULO {cIndex + 1}</Text>
            <TouchableOpacity
              hitSlop={8}
              onPress={() => onRemoveCapitulo(cap.id)}
              style={styles.removeCapBtn}>
              <MaterialIcons name="remove" size={14} color={Colors.background} />
            </TouchableOpacity>
          </View>
          <TextInput
            ref={(r) => { inputRefs.current[cap.id] = r; }}
            style={styles.contenidoInput}
            value={cap.contenido}
            onChangeText={(t) => onUpdateCapitulo(cap.id, t)}
            placeholder="Escribir"
            placeholderTextColor={Colors.textMuted}
            multiline
            textAlignVertical="top"
          />
        </View>
      ))}

      <TouchableOpacity onPress={onAddCapitulo} style={styles.cardFooter}>
        <Text style={styles.nuevoCapituloText}>Nuevo capítulo</Text>
      </TouchableOpacity>

    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NuevaHistoriaScreen() {
  const [borradores, setBorradores] = useState<Borrador[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  // Load from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((json) => {
        const saved = safeParse(BorradoresSchema, json);
        setBorradores(saved && saved.length > 0 ? saved : [createBorrador()]);
        setLoaded(true);
      })
      .catch(() => {
        setBorradores([createBorrador()]);
        setLoaded(true);
      });
  }, []);

  // Save to storage on every change
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(borradores)).catch(() => {});
  }, [borradores, loaded]);

  // ── Operations ──────────────────────────────────────────────────────────────

  function addBorrador() {
    const nuevo = createBorrador();
    setBorradores((prev) => [nuevo, ...prev]);
    setFocusedId(nuevo.id);
  }

  function bringToTop(id: string) {
    setBorradores((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx <= 0) return prev;
      const item = prev[idx];
      return [item, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
    });
  }

  function deleteBorrador(id: string) {
    setBorradores((prev) => {
      const next = prev.filter((b) => b.id !== id);
      return next.length > 0 ? next : [createBorrador()];
    });
  }

  function updateField(id: string, field: 'titulo' | 'sinopsis', value: string) {
    setBorradores((prev) =>
      prev.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    );
  }

  function addCapitulo(borradorId: string) {
    setBorradores((prev) =>
      prev.map((b) =>
        b.id === borradorId
          ? { ...b, capitulos: [...b.capitulos, { id: Date.now().toString(), contenido: '' }] }
          : b
      )
    );
  }

  function removeCapitulo(borradorId: string, capId: string) {
    setBorradores((prev) =>
      prev.map((b) => {
        if (b.id !== borradorId) return b;
        return { ...b, capitulos: b.capitulos.filter((c) => c.id !== capId) };
      })
    );
  }

  function updateCapitulo(borradorId: string, capId: string, text: string) {
    setBorradores((prev) =>
      prev.map((b) =>
        b.id === borradorId
          ? { ...b, capitulos: b.capitulos.map((c) => (c.id === capId ? { ...c, contenido: text } : c)) }
          : b
      )
    );
  }

  async function publishBorrador(id: string, genero: string) {
    const borrador = borradores.find((b) => b.id === id);
    if (!borrador) return;
    try {
      // Obtener usuario logueado
      const userResult = await supabase.auth.getUser();
      const user = userResult.data?.user ?? null;
      if (!user) throw new Error('Usuario no autenticado');

      // Insertar historia en Supabase
      const contenido = [borrador.sinopsis, ...borrador.capitulos.map((c) => c.contenido)]
        .filter(Boolean)
        .join('\n\n');
      const { error } = await supabase.from('stories').insert({
        autor_id: user.id,
        titulo: borrador.titulo,
        contenido,
        genero,
      });
      if (error) throw error;

      // El borrador se elimina localmente; las historias publicadas van a BD
      deleteBorrador(id);
      setPublishingId(null);
      router.back();
    } catch {
      // Mantener el estado para que el usuario pueda reintentar
    }
  }

  if (!loaded) return null;

  // ── Genre picker overlay ─────────────────────────────────────────────────────
  if (publishingId) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity hitSlop={8} onPress={() => { setPublishingId(null); setSelectedGenre(null); }}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerPlaceholder} />
          {selectedGenre ? (
            <TouchableOpacity
              hitSlop={8}
              onPress={() => { publishBorrador(publishingId, selectedGenre); setSelectedGenre(null); }}>
              <Text style={styles.publishConfirmText}>Publicar</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.headerPlaceholder} />
          )}
        </View>
        <Text style={styles.genrePrompt}>¿En qué género clasificarías esta historia?</Text>
        <ScrollView contentContainerStyle={styles.genreGrid}>
          {GENRES.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.genreChip, selectedGenre === g && styles.genreChipActive]}
              onPress={() => setSelectedGenre(g)}>
              <Text style={[styles.genreChipText, selectedGenre === g && styles.genreChipTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    );
  }

  const focusedBorrador = focusedId ? borradores.find((b) => b.id === focusedId) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        {focusedBorrador ? (
          <TouchableOpacity hitSlop={8} onPress={() => { Keyboard.dismiss(); setFocusedId(null); }}>
            <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerPlaceholder} />
        )}
        {focusedBorrador ? (
          <View style={styles.headerPlaceholder} />
        ) : (
          <Text style={styles.wordmark}>Borradores</Text>
        )}
        {focusedBorrador ? (
          <TouchableOpacity
            style={styles.publicarHeaderBtn}
            onPress={() => { Keyboard.dismiss(); bringToTop(focusedBorrador.id); setFocusedId(null); }}>
            <Text style={styles.publicarHeaderText}>Guardar</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerPlaceholder} />
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {focusedBorrador ? (
          // Focus mode: floating card over blurred overlay
          <View style={styles.flex}>
            <BlurView intensity={40} tint="dark" style={styles.focusOverlay} />
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.focusScrollContent}
              keyboardShouldPersistTaps="handled">
              <ExpandedCard
                b={focusedBorrador}
                onUpdateTitulo={(value) => updateField(focusedBorrador.id, 'titulo', value)}
                onUpdateSinopsis={(value) => updateField(focusedBorrador.id, 'sinopsis', value)}
                onAddCapitulo={() => addCapitulo(focusedBorrador.id)}
                onRemoveCapitulo={(capId) => removeCapitulo(focusedBorrador.id, capId)}
                onUpdateCapitulo={(capId, text) => updateCapitulo(focusedBorrador.id, capId, text)}
              />
              <TouchableOpacity
                style={styles.publicarBelowCard}
                onPress={() => { Keyboard.dismiss(); setFocusedId(null); setPublishingId(focusedBorrador.id); }}>
                <Text style={styles.publicarBelowText}>Publicar</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        ) : (
          // List mode: collapsed cards
          <>
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled">
              {borradores.map((b) => (
                <CollapsedCard
                  key={b.id}
                  b={b}
                  onDelete={() => deleteBorrador(b.id)}
                  onEnterFocus={() => setFocusedId(b.id)}
                />
              ))}
            </ScrollView>

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.95)']}
              style={styles.fabGradient}
              pointerEvents="none"
            />
            <TouchableOpacity style={styles.fab} onPress={addBorrador}>
              <MaterialIcons name="add" size={28} color={Colors.background} />
            </TouchableOpacity>
          </>
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerPlaceholder: { width: 26 },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  wordmark: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 120,
    gap: 16,
  },
  focusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  focusScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  // FAB gradient
  fabGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Swipe delete
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginLeft: 8,
  },
  deleteButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#c0392b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Card base
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  // Collapsed card display
  tituloDisplay: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: 'bold',
  },
  sinopsisDisplay: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  capitulosCount: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  // Expanded card inputs
  tituloInput: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: 'bold',
    paddingVertical: 0,
  },
  sinopsisInput: {
    color: Colors.text,
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 0,
  },
  capituloHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  capituloLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  removeCapBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contenidoInput: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 21,
    minHeight: 40,
    paddingVertical: 0,
  },
  // Footer row
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  nuevoCapituloText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  editarBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.text,
  },
  editarText: {
    color: Colors.background,
    fontSize: 13,
    fontWeight: '600',
  },
  publicarBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.text,
  },
  publicarText: {
    color: Colors.background,
    fontSize: 13,
    fontWeight: '600',
  },
  publicarHeaderBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  publicarHeaderText: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  publicarBelowCard: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: '#1f566b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  publicarBelowText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  genrePrompt: {
    color: Colors.textMuted,
    fontSize: 14,
    paddingHorizontal: 20,
    paddingBottom: 16,
    lineHeight: 20,
  },
  genreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 40,
  },
  genreChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
  genreChipActive: {
    backgroundColor: '#1f566b',
    borderColor: '#1f566b',
  },
  genreChipText: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
  genreChipTextActive: {
    color: '#ffffff',
  },
  publishConfirmText: {
    color: '#1f566b',
    fontSize: 17,
    fontWeight: '600',
  },
});
