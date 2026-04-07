import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatsMapSchema, LikedIdsSchema, PublishedStoriesSchema, safeParse } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';
import { deleteSecure, SecureKeys } from '@/lib/secureStorage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
const CHATS_KEY = 'thot_chats';
import { BlurView } from 'expo-blur';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

const PUBLISHED_KEY = 'thot_publicados';
const LIKED_KEY = 'thot_liked_stories';

const MOCK_STORIES: PublishedStory[] = [
  {
    id: 'mock1',
    titulo: 'La Pluma de Thot',
    sinopsis: 'Un joven escritor encuentra una antigua pluma que perteneció a Thot, el dios egipcio de la escritura. Cada vez que la usa, sus historias cobran vida en el mundo real.',
    capitulos: [
      { id: 'mc1', contenido: 'Era una mañana de octubre cuando Marcus encontró la pluma entre los escombros de la librería de su abuelo. No parecía especial, pero al tocarla sintió un hormigueo que le recorrió los dedos hasta el corazón.' },
      { id: 'mc2', contenido: 'Al día siguiente, la ciudad había cambiado. Las calles que había descrito en su historia nocturna aparecían ante él tal y como las había imaginado. La pluma no era una herramienta. Era una llave.' },
    ],
    likes: 24,
  },
  {
    id: 'mock2',
    titulo: 'El Taller Oculto',
    sinopsis: 'En una ciudad mágica, las ideas perdidas y olvidadas toman forma física. Los habitantes buscan estas ideas para devolverlas a los creativos del mundo real.',
    capitulos: [],
    likes: 8,
  },
  {
    id: 'mock3',
    titulo: 'Diálogo con el Reloj',
    sinopsis: 'Un relojero encuentra un antiguo reloj que puede detener el tiempo para permitir a los creativos trabajar sin interrupciones.',
    capitulos: [
      { id: 'mc3', contenido: 'Tic, tac. Tic, tac. Llevo cien años midiendo el tiempo de este hombre y nunca había visto sus manos temblar como esta noche. Algo ha cambiado. El engranaje que mueve su vida acaba de romperse.' },
    ],
    likes: 15,
  },
  {
    id: 'mock4',
    titulo: 'Fragmentos',
    sinopsis: 'Cinco escritores. Una historia. Ninguno sabe lo que escribieron los demás.',
    capitulos: [
      { id: 'mc4', contenido: 'La primera vez que vi el mar tenía cuarenta años. No sé por qué lo había evitado tanto tiempo, quizás porque el horizonte siempre me pareció una promesa que no pensaba cumplir.' },
      { id: 'mc5', contenido: 'Ella dejó el sobre sobre la mesa sin decir nada. Dentro había una llave y una dirección. Fui, claro. Siempre voy.' },
      { id: 'mc6', contenido: 'El final no era lo que esperábamos. Nunca lo es. Pero ahí estaba, inevitable, brillando como el faro que lleva toda la noche guiándonos hacia los arrecifes.' },
    ],
    likes: 41,
  },
];

type CapituloState = { id: string; contenido: string };

type PublishedStory = {
  id: string;
  titulo: string;
  sinopsis: string;
  capitulos: CapituloState[];
  likes: number;
};

type ChatMsg = { id: string; role: 'me' | 'other'; text: string };

// ─── Chat Overlay ─────────────────────────────────────────────────────────────

function ChatOverlay({ autor, onClose }: { autor: string; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [recording, setRecording] = useState(false);

  function handleMic() {
    setRecording(true);
    setTimeout(() => {
      setRecording(false);
      setInput('[Audio transcrito]');
    }, 2000);
  }
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    AsyncStorage.getItem(CHATS_KEY)
      .then((json) => {
        const all = safeParse(ChatsMapSchema, json) ?? {};
        setMessages(all[autor] ?? []);
      })
      .catch(() => setMessages([]));
  }, [autor]);

  async function send() {
    const text = input.trim().slice(0, 5000);
    if (!text) return;
    const msg: ChatMsg = { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, role: 'me', text };
    const updated = [...messages, msg];
    setMessages(updated);
    setInput('');
    try {
      const json = await AsyncStorage.getItem(CHATS_KEY);
      let all: Record<string, ChatMsg[]> = {};
      try { if (json) all = JSON.parse(json); } catch {}
      all[autor] = updated;
      await AsyncStorage.setItem(CHATS_KEY, JSON.stringify(all));
    } catch {}
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top', 'left', 'right']}>
      <View style={chatStyles.header}>
        <TouchableOpacity hitSlop={8} onPress={onClose}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={chatStyles.headerCenter}>
          <View style={chatStyles.miniAvatar} />
          <Text style={chatStyles.headerName}>@{autor}</Text>
        </View>
        <View style={chatStyles.placeholder} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          style={{ flex: 1 }}
          contentContainerStyle={[chatStyles.messages, { flexGrow: 1 }]}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={<Text style={chatStyles.empty}>Empieza la conversación con @{autor}</Text>}
          renderItem={({ item: msg }) =>
            msg.role === 'me' ? (
              <View style={chatStyles.rowMe}>
                <View style={chatStyles.bubbleMe}>
                  <Text style={chatStyles.bubbleMeText}>{msg.text}</Text>
                </View>
              </View>
            ) : (
              <View style={chatStyles.rowOther}>
                <View style={chatStyles.miniAvatar} />
                <View style={chatStyles.bubbleOther}>
                  <Text style={chatStyles.bubbleOtherText}>{msg.text}</Text>
                </View>
              </View>
            )
          }
        />
        <View style={chatStyles.inputRow}>
          <TextInput
            style={chatStyles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Mensaje..."
            placeholderTextColor={Colors.textMuted}
            multiline
            autoFocus
          />
          <TouchableOpacity
            style={chatStyles.sendBtn}
            onPress={input.trim() ? send : handleMic}>
            <MaterialIcons
              name={input.trim() ? 'send' : (recording ? 'stop' : 'mic')}
              size={22}
              color={recording ? '#e74c3c' : Colors.text}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Chats List Overlay ───────────────────────────────────────────────────────

function ChatsListOverlay({
  onClose,
  onOpenChat,
}: {
  onClose: () => void;
  onOpenChat: (autor: string) => void;
}) {
  const [chats, setChats] = useState<{ autor: string; last: string }[]>([]);

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(CHATS_KEY)
        .then((json) => {
          const all = safeParse(ChatsMapSchema, json) ?? {};
          const list = Object.entries(all)
            .filter(([, msgs]) => msgs.length > 0)
            .map(([autor, msgs]) => ({ autor, last: msgs[msgs.length - 1].text, ts: parseInt(msgs[msgs.length - 1].id) }))
            .sort((a, b) => b.ts - a.ts)
            .map(({ autor, last }) => ({ autor, last }));
          setChats(list);
        })
        .catch(() => setChats([]));
    }, [])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top', 'left', 'right']}>
      <View style={chatStyles.header}>
        <TouchableOpacity hitSlop={8} onPress={onClose}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={chatStyles.listTitle}>Mensajes</Text>
        <View style={chatStyles.placeholder} />
      </View>

      {chats.length === 0 ? (
        <Text style={[chatStyles.empty, { marginTop: 60, paddingHorizontal: 32 }]}>
          Aún no tienes conversaciones.
        </Text>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => c.autor}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, gap: 4 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={chatStyles.chatRow} onPress={() => onOpenChat(item.autor)}>
              <View style={chatStyles.miniAvatarLg} />
              <View style={{ flex: 1 }}>
                <Text style={chatStyles.chatRowName}>@{item.autor}</Text>
                <Text style={chatStyles.chatRowLast} numberOfLines={1}>{item.last}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const chatStyles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.background, flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerName: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  listTitle: { color: Colors.text, fontSize: 22, fontWeight: 'bold', fontFamily: 'Helvetica-Bold', letterSpacing: -0.5 },
  placeholder: { width: 24 },
  miniAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.border },
  miniAvatarLg: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.border, marginRight: 14 },
  messages: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 12 },
  empty: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
  rowMe: { alignItems: 'flex-end' },
  bubbleMe: {
    backgroundColor: Colors.text,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '75%',
  },
  bubbleMeText: { color: Colors.background, fontSize: 15, lineHeight: 21 },
  rowOther: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubbleOther: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '75%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bubbleOtherText: { color: Colors.text, fontSize: 15, lineHeight: 21 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: 18,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 15,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1f566b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  chatRowName: { color: Colors.text, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  chatRowLast: { color: Colors.textMuted, fontSize: 13 },
});

// ─── Edit Profile Overlay ─────────────────────────────────────────────────────

function EditProfileOverlay({
  username,
  onSave,
  onBack,
}: {
  username: string;
  onSave: (newUsername: string) => void;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState(username);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={overlayStyles.header}>
        <TouchableOpacity hitSlop={8} onPress={onBack}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={overlayStyles.headerTitle}>Editar perfil</Text>
        <TouchableOpacity hitSlop={8} onPress={() => onSave(draft.trim() || username)}>
          <Text style={overlayStyles.saveBtn}>Guardar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={overlayStyles.scroll}>
        {/* Avatar */}
        <TouchableOpacity
          style={overlayStyles.avatarSection}
          activeOpacity={0.8}
          onPress={() => Alert.alert('Foto de perfil', 'Esta función estará disponible próximamente con acceso a la cámara y la galería.')}>
          <View style={overlayStyles.bigAvatar} />
          <View style={overlayStyles.cameraOverlay}>
            <MaterialIcons name="camera-alt" size={16} color="#fff" />
          </View>
          <Text style={overlayStyles.changePhotoText}>Cambiar foto</Text>
        </TouchableOpacity>

        {/* Fields */}
        <View style={overlayStyles.fieldGroup}>
          <Text style={overlayStyles.fieldLabel}>Nombre de usuario</Text>
          <TextInput
            style={overlayStyles.fieldInput}
            value={draft}
            onChangeText={setDraft}
            autoCapitalize="none"
            autoCorrect={false}
            placeholderTextColor={Colors.textMuted}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Settings Overlay ─────────────────────────────────────────────────────────

function SettingsRow({ icon, label, value, onPress }: { icon: string; label: string; value?: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={overlayStyles.settingsRow} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <MaterialIcons name={icon as any} size={20} color={Colors.textMuted} style={{ width: 28 }} />
      <Text style={overlayStyles.settingsLabel}>{label}</Text>
      <View style={{ flex: 1 }} />
      {!!value && <Text style={overlayStyles.settingsValue}>{value}</Text>}
      {!!onPress && <MaterialIcons name="chevron-right" size={18} color={Colors.textMuted} />}
    </TouchableOpacity>
  );
}

function SettingsToggle({ icon, label, value, onToggle }: { icon: string; label: string; value: boolean; onToggle: (v: boolean) => void }) {
  return (
    <View style={overlayStyles.settingsRow}>
      <MaterialIcons name={icon as any} size={20} color={Colors.textMuted} style={{ width: 28 }} />
      <Text style={overlayStyles.settingsLabel}>{label}</Text>
      <View style={{ flex: 1 }} />
      <TouchableOpacity
        style={[overlayStyles.toggle, value && overlayStyles.toggleOn]}
        onPress={() => onToggle(!value)}
        activeOpacity={0.8}>
        <View style={[overlayStyles.toggleThumb, value && overlayStyles.toggleThumbOn]} />
      </TouchableOpacity>
    </View>
  );
}

function SettingsOverlay({
  username,
  totalLikes,
  totalStories,
  followers,
  onBack,
}: {
  username: string;
  totalLikes: number;
  totalStories: number;
  followers: number;
  onBack: () => void;
}) {
  const [privateAccount, setPrivateAccount] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [twoFactor, setTwoFactor] = useState(false);

  async function logout() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          await deleteSecure(SecureKeys.SESSION);
          await deleteSecure(SecureKeys.THOT_CONVOS);
          router.replace('/');
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top', 'left', 'right']}>
      <View style={overlayStyles.header}>
        <TouchableOpacity hitSlop={8} onPress={onBack}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={overlayStyles.headerTitle}>Configuración</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={overlayStyles.scroll} showsVerticalScrollIndicator={false}>
        {/* Stats */}
        <View style={overlayStyles.statsCard}>
          <View style={overlayStyles.statItem}>
            <Text style={overlayStyles.statNumber}>{totalLikes}</Text>
            <Text style={overlayStyles.statLabel}>me gusta</Text>
          </View>
          <View style={overlayStyles.statDivider} />
          <View style={overlayStyles.statItem}>
            <Text style={overlayStyles.statNumber}>{totalStories}</Text>
            <Text style={overlayStyles.statLabel}>historias</Text>
          </View>
          <View style={overlayStyles.statDivider} />
          <View style={overlayStyles.statItem}>
            <Text style={overlayStyles.statNumber}>{followers}</Text>
            <Text style={overlayStyles.statLabel}>seguidores</Text>
          </View>
        </View>

        {/* Cuenta */}
        <Text style={overlayStyles.sectionTitle}>Cuenta</Text>
        <View style={overlayStyles.section}>
          <SettingsRow icon="person" label="Usuario" value={`@${username}`} />
          <SettingsRow icon="email" label="Correo electrónico" value="ra***@email.com" />
          <SettingsRow icon="lock" label="Contraseña" value="Cambiar" onPress={() => Alert.alert('Contraseña', 'Redirigiendo al flujo de cambio de contraseña.')} />
          <SettingsToggle icon="security" label="Verificación en dos pasos" value={twoFactor} onToggle={setTwoFactor} />
        </View>

        {/* Privacidad */}
        <Text style={overlayStyles.sectionTitle}>Privacidad</Text>
        <View style={overlayStyles.section}>
          <SettingsToggle icon="lock-outline" label="Cuenta privada" value={privateAccount} onToggle={setPrivateAccount} />
          <SettingsToggle icon="notifications" label="Notificaciones" value={notifications} onToggle={setNotifications} />
        </View>

        {/* Información */}
        <Text style={overlayStyles.sectionTitle}>Información</Text>
        <View style={overlayStyles.section}>
          <SettingsRow icon="info-outline" label="Versión de la app" value="1.0.0" />
          <SettingsRow icon="description" label="Términos y condiciones" onPress={() => Alert.alert('Términos', 'Próximamente disponible.')} />
          <SettingsRow icon="privacy-tip" label="Política de privacidad" onPress={() => Alert.alert('Privacidad', 'Próximamente disponible.')} />
        </View>

        {/* Cerrar sesión */}
        <TouchableOpacity style={overlayStyles.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <Text style={overlayStyles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const overlayStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  saveBtn: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  scroll: { paddingBottom: 48 },
  // Edit profile
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  bigAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 28 + 96 - 28,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1f566b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  changePhotoText: {
    color: '#1f566b',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  fieldGroup: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 20,
  },
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fieldInput: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 18,
    color: Colors.text,
    fontSize: 15,
  },
  // Settings
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 20,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statNumber: { color: Colors.text, fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: Colors.textMuted, fontSize: 12 },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 8,
    marginTop: 8,
  },
  section: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
  },
  settingsLabel: { color: Colors.text, fontSize: 15 },
  settingsValue: { color: Colors.textMuted, fontSize: 14, marginRight: 4 },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: '#1f566b' },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.textMuted,
  },
  toggleThumbOn: {
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },
  logoutBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 32,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: '#c0392b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: '#c0392b', fontSize: 15, fontWeight: '600' },
});

// ─── Story Card ───────────────────────────────────────────────────────────────

function StoryCard({
  relato,
  liked,
  onEditar,
  onBorrar,
  onSwipeOpen,
  onLeer,
}: {
  relato: PublishedStory;
  liked: boolean;
  onEditar: () => void;
  onBorrar: () => void;
  onSwipeOpen: (ref: Swipeable) => void;
  onLeer: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  function renderRightActions(progress: Animated.AnimatedInterpolation<number>) {
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [112, 0],
    });
    return (
      <Animated.View style={[styles.swipeActions, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={styles.actionCircle}
          onPress={() => { swipeRef.current?.close(); onEditar(); }}>
          <MaterialIcons name="edit" size={18} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionCircleDanger}
          onPress={() => { swipeRef.current?.close(); onBorrar(); }}>
          <MaterialIcons name="delete-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    );
  }

  const capCount = relato.capitulos.length;

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      onSwipeableOpen={() => onSwipeOpen(swipeRef.current!)}>
      <TouchableOpacity activeOpacity={0.85} onPress={onLeer}>
        <View style={styles.card}>
          {/* Title row */}
          <View style={styles.cardHeader}>
            <Text style={styles.tituloDisplay} numberOfLines={1}>
              {relato.titulo || 'Sin título'}
            </Text>
            <TouchableOpacity
              hitSlop={8}
              onPress={() => { onSwipeOpen(swipeRef.current!); swipeRef.current?.openRight(); }}>
              <MaterialIcons name="more-horiz" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          {/* Sinopsis */}
          {!!relato.sinopsis && (
            <Text style={styles.sinopsisDisplay} numberOfLines={3}>{relato.sinopsis}</Text>
          )}
          {/* Footer: chapter count + likes */}
          <View style={styles.cardFooter}>
            {capCount > 0 ? (
              <Text style={styles.capitulosCount}>
                {capCount} {capCount === 1 ? 'capítulo' : 'capítulos'}
              </Text>
            ) : (
              <View />
            )}
            <View style={styles.likesRow}>
              <MaterialIcons
                name={liked ? 'favorite' : 'favorite-border'}
                size={14}
                color={liked ? '#e74c3c' : Colors.textMuted}
              />
              <Text style={styles.likesCount}>{relato.likes}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PerfilScreen() {
  const [relatos, setRelatos] = useState<PublishedStory[]>([]);
  const [activeTab, setActiveTab] = useState<'recientes' | 'populares'>('recientes');
  const [editDraft, setEditDraft] = useState<PublishedStory | null>(null);
  const [readingStory, setReadingStory] = useState<PublishedStory | null>(null);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [chatsOpen, setChatsOpen] = useState(false);
  const [chatAutor, setChatAutor] = useState<string | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileUsername, setProfileUsername] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const navigation = useNavigation();

  useEffect(() => {
    const unsub = navigation.addListener('tabPress' as any, () => {
      setReadingStory(null);
      setEditDraft(null);
      setChatsOpen(false);
      setChatAutor(null);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return unsub;
  }, [navigation]);
  const openSwipeRef = useRef<Swipeable | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const tituloInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (editDraft) {
      const t = setTimeout(() => tituloInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [!!editDraft]);

  useFocusEffect(
    useCallback(() => {
      async function loadProfile() {
        try {
          // Obtener usuario logueado
          const userResult = await supabase.auth.getUser();
          const user = userResult.data?.user ?? null;
          if (!user) return;
          setCurrentUserId(user.id);

          // Cargar perfil
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          if (profileData?.nombre) {
            setProfileUsername(profileData.nombre);
          }

          // Cargar historias publicadas del usuario desde Supabase
          const { data: storiesData } = await supabase
            .from('stories')
            .select('*')
            .eq('autor_id', user.id)
            .order('published_at', { ascending: false });

          if (storiesData && storiesData.length > 0) {
            const mapped: PublishedStory[] = storiesData.map((s: any) => ({
              id: s.id,
              titulo: s.titulo ?? '',
              sinopsis: s.contenido ?? '',
              capitulos: [],
              likes: s.likes_count ?? 0,
            }));
            setRelatos(mapped);
          } else {
            // Fallback a AsyncStorage + mocks si Supabase está vacío
            const storiesJson = await AsyncStorage.getItem(PUBLISHED_KEY);
            const parsed = safeParse(PublishedStoriesSchema, storiesJson) ?? [];
            const existingIds = new Set(parsed.map((s) => s.id));
            const toAdd = MOCK_STORIES.filter((m) => !existingIds.has(m.id));
            const merged = [...toAdd, ...parsed];
            if (toAdd.length > 0) {
              await AsyncStorage.setItem(PUBLISHED_KEY, JSON.stringify(merged)).catch(() => {});
            }
            setRelatos(merged);
          }

          // Cargar likes desde AsyncStorage (los likes del perfil propio son locales)
          const likedJson = await AsyncStorage.getItem(LIKED_KEY);
          const liked = safeParse(LikedIdsSchema, likedJson);
          setLikedIds(new Set(liked ?? []));
        } catch {
          // Fallback completo a mocks
          setRelatos([...MOCK_STORIES]);
        }
        openSwipeRef.current?.close();
        openSwipeRef.current = null;
      }
      loadProfile();
    }, [])
  );

  async function toggleLike(id: string) {
    const alreadyLiked = likedIds.has(id);
    const newLikedIds = new Set(likedIds);
    if (alreadyLiked) {
      newLikedIds.delete(id);
    } else {
      newLikedIds.add(id);
    }
    const updated = relatos.map((r) =>
      r.id === id ? { ...r, likes: r.likes + (alreadyLiked ? -1 : 1) } : r
    );
    setLikedIds(newLikedIds);
    setRelatos(updated);
    await Promise.all([
      AsyncStorage.setItem(PUBLISHED_KEY, JSON.stringify(updated)).catch(() => {}),
      AsyncStorage.setItem(LIKED_KEY, JSON.stringify([...newLikedIds])).catch(() => {}),
    ]);
  }

  function handleSwipeOpen(ref: Swipeable) {
    if (openSwipeRef.current && openSwipeRef.current !== ref) {
      openSwipeRef.current.close();
    }
    openSwipeRef.current = ref;
  }

  function confirmarBorrado(id: string) {
    Alert.alert(
      'Eliminar publicación',
      '¿Seguro que quieres eliminar esta publicación? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const updated = relatos.filter((r) => r.id !== id);
            setRelatos(updated);
            await AsyncStorage.setItem(PUBLISHED_KEY, JSON.stringify(updated)).catch(() => {});
          },
        },
      ]
    );
  }

  function handleEditBack() {
    Alert.alert(
      'Cancelar edición',
      'Se perderán los cambios realizados.',
      [
        { text: 'Seguir editando', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => setEditDraft(null) },
      ]
    );
  }

  async function handleEditSave() {
    if (!editDraft) return;
    const updated = relatos.map((r) => r.id === editDraft.id ? editDraft : r);
    setRelatos(updated);
    await AsyncStorage.setItem(PUBLISHED_KEY, JSON.stringify(updated)).catch(() => {});
    setEditDraft(null);
  }

  function updateDraftCapitulo(capId: string, contenido: string) {
    if (!editDraft) return;
    setEditDraft({
      ...editDraft,
      capitulos: editDraft.capitulos.map((c) => c.id === capId ? { ...c, contenido } : c),
    });
  }

  function addDraftCapitulo() {
    if (!editDraft) return;
    setEditDraft({
      ...editDraft,
      capitulos: [...editDraft.capitulos, { id: Date.now().toString(), contenido: '' }],
    });
  }

  function removeDraftCapitulo(capId: string) {
    if (!editDraft) return;
    setEditDraft({
      ...editDraft,
      capitulos: editDraft.capitulos.filter((c) => c.id !== capId),
    });
  }

  const feed =
    activeTab === 'populares'
      ? [...relatos].sort((a, b) => b.likes - a.likes)
      : relatos;

  if (chatAutor) {
    return <ChatOverlay autor={chatAutor} onClose={() => setChatAutor(null)} />;
  }
  if (chatsOpen) {
    return <ChatsListOverlay onClose={() => setChatsOpen(false)} onOpenChat={setChatAutor} />;
  }
  if (editProfileOpen) {
    return (
      <EditProfileOverlay
        username={profileUsername}
        onSave={(u) => { setProfileUsername(u); setEditProfileOpen(false); }}
        onBack={() => setEditProfileOpen(false)}
      />
    );
  }
  if (settingsOpen) {
    return (
      <SettingsOverlay
        username={profileUsername}
        totalLikes={relatos.reduce((sum, r) => sum + r.likes, 0)}
        totalStories={relatos.length}
        followers={47}
        onBack={() => setSettingsOpen(false)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.headerPlaceholder} />
        <Text style={styles.username}>{profileUsername}</Text>
        <TouchableOpacity hitSlop={8} onPress={() => setChatsOpen(true)}>
          <MaterialIcons name="send" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Profile header */}
      <View style={styles.profileRow}>
        <View style={styles.avatar} />
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{relatos.length}</Text>
            <Text style={styles.statLabel}>historias</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>47</Text>
            <Text style={styles.statLabel}>seguidores</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{relatos.reduce((sum, r) => sum + r.likes, 0)}</Text>
            <Text style={styles.statLabel}>me gusta</Text>
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setEditProfileOpen(true)}>
          <Text style={styles.actionBtnText}>Editar perfil</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setSettingsOpen(true)}>
          <Text style={styles.actionBtnText}>Configuración</Text>
        </TouchableOpacity>
      </View>

      {/* Feed tabs */}
      <View style={styles.feedTabs}>
        <TouchableOpacity
          style={[styles.feedTab, activeTab === 'recientes' && styles.feedTabActive]}
          onPress={() => setActiveTab('recientes')}>
          <MaterialIcons
            name="access-time"
            size={22}
            color={activeTab === 'recientes' ? Colors.text : Colors.textMuted}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.feedTab, activeTab === 'populares' && styles.feedTabActive]}
          onPress={() => setActiveTab('populares')}>
          <MaterialIcons
            name="favorite-border"
            size={22}
            color={activeTab === 'populares' ? Colors.text : Colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* Stories list */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => openSwipeRef.current?.close()}>
        {feed.length === 0 ? (
          <Text style={styles.emptyText}>Aún no has publicado ninguna historia.</Text>
        ) : (
          feed.map((relato) => (
            <StoryCard
              key={relato.id}
              relato={relato}
              liked={likedIds.has(relato.id)}
              onEditar={() => setEditDraft({ ...relato, capitulos: [...relato.capitulos] })}
              onBorrar={() => confirmarBorrado(relato.id)}
              onSwipeOpen={handleSwipeOpen}
              onLeer={() => setReadingStory(relato)}
            />
          ))
        )}
      </ScrollView>

      {/* Reading overlay */}
      {readingStory && (
        <SafeAreaView style={styles.readingOverlay} edges={['top', 'left', 'right']}>
          <View style={styles.focusHeader}>
            <TouchableOpacity hitSlop={8} onPress={() => setReadingStory(null)}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.headerPlaceholder} />
          </View>
          <ScrollView
            contentContainerStyle={styles.focusScroll}
            showsVerticalScrollIndicator={false}>
            <View style={styles.focusCard}>
              <Text style={styles.readingTitulo}>{readingStory.titulo || 'Sin título'}</Text>
              {!!readingStory.sinopsis && (
                <Text style={styles.readingTexto}>{readingStory.sinopsis}</Text>
              )}
              {readingStory.capitulos.map((cap, idx) => (
                <View key={cap.id} style={styles.capituloBlock}>
                  <Text style={styles.capituloLabel}>CAPÍTULO {idx + 1}</Text>
                  <Text style={styles.readingTexto}>{cap.contenido}</Text>
                </View>
              ))}
            </View>

            {/* Like button */}
            {(() => {
              const current = relatos.find((r) => r.id === readingStory.id);
              const liked = likedIds.has(readingStory.id);
              return (
                <TouchableOpacity style={styles.likeBtn} onPress={() => toggleLike(readingStory.id)}>
                  <MaterialIcons
                    name={liked ? 'favorite' : 'favorite-border'}
                    size={26}
                    color={liked ? '#e74c3c' : Colors.text}
                  />
                  <Text style={styles.likeBtnCount}>{current?.likes ?? readingStory.likes}</Text>
                </TouchableOpacity>
              );
            })()}
          </ScrollView>
        </SafeAreaView>
      )}

      {/* Focus mode: edit overlay */}
      {editDraft && (
        <>
          <BlurView style={StyleSheet.absoluteFillObject} intensity={40} tint="dark" />
          <SafeAreaView style={StyleSheet.absoluteFillObject} edges={['top', 'left', 'right']} pointerEvents="box-none">
            {/* Edit header */}
            <View style={styles.focusHeader}>
              <TouchableOpacity hitSlop={8} onPress={handleEditBack}>
                <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
              </TouchableOpacity>
              <View style={styles.headerPlaceholder} />
              <TouchableOpacity style={styles.guardarBtn} onPress={handleEditSave}>
                <Text style={styles.guardarText}>Guardar</Text>
              </TouchableOpacity>
            </View>

            {/* Editable card */}
            <KeyboardAvoidingView
              style={styles.flex}
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <ScrollView
                contentContainerStyle={styles.focusScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>
                <View style={styles.focusCard}>
                  {/* Título */}
                  <TextInput
                    ref={tituloInputRef}
                    style={styles.focusTitulo}
                    value={editDraft.titulo}
                    onChangeText={(v) => setEditDraft({ ...editDraft, titulo: v })}
                    placeholder="Título"
                    placeholderTextColor={Colors.textMuted}
                    multiline
                  />
                  {/* Sinopsis */}
                  <TextInput
                    style={styles.focusTexto}
                    value={editDraft.sinopsis}
                    onChangeText={(v) => setEditDraft({ ...editDraft, sinopsis: v })}
                    placeholder="Escribir"
                    placeholderTextColor={Colors.textMuted}
                    multiline
                  />
                  {/* Capítulos */}
                  {editDraft.capitulos.map((cap, idx) => (
                    <View key={cap.id} style={styles.capituloBlock}>
                      <View style={styles.capituloHeaderRow}>
                        <Text style={styles.capituloLabel}>CAPÍTULO {idx + 1}</Text>
                        <TouchableOpacity hitSlop={8} onPress={() => removeDraftCapitulo(cap.id)} style={styles.removeCapBtn}>
                          <MaterialIcons name="remove" size={14} color={Colors.background} />
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        style={styles.focusTexto}
                        value={cap.contenido}
                        onChangeText={(v) => updateDraftCapitulo(cap.id, v)}
                        placeholder="Escribir"
                        placeholderTextColor={Colors.textMuted}
                        multiline
                      />
                    </View>
                  ))}
                  {/* Nuevo capítulo */}
                  <TouchableOpacity onPress={addDraftCapitulo} style={styles.nuevoCapituloBtn}>
                    <Text style={styles.nuevoCapituloText}>Nuevo capítulo</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerPlaceholder: { width: 24 },
  username: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -0.5,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 24,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center', gap: 2 },
  statNumber: { color: Colors.text, fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: Colors.textMuted, fontSize: 12 },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  actionBtnText: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  feedTabs: { flexDirection: 'row', marginTop: 8 },
  feedTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  feedTabActive: { borderBottomColor: Colors.text },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },
  // Swipe
  swipeActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
    paddingLeft: 8,
  },
  actionCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCircleDanger: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#c0392b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Card
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  tituloDisplay: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  sinopsisDisplay: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  capitulosCount: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  likesRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  likesCount: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  // Focus / edit overlay
  focusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  guardarBtn: { paddingHorizontal: 14, paddingVertical: 6 },
  guardarText: { color: Colors.text, fontSize: 17, fontWeight: '600' },
  focusScroll: { paddingHorizontal: 16, paddingBottom: 40 },
  focusCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  focusTitulo: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 14,
    padding: 0,
  },
  focusTexto: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 22,
    padding: 0,
    minHeight: 80,
  },
  capituloBlock: { marginTop: 36 },
  capituloHeaderRow: {
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
    marginBottom: 10,
  },
  removeCapBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nuevoCapituloBtn: { marginTop: 20, alignSelf: 'flex-start' },
  nuevoCapituloText: { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },
  readingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 24,
    paddingVertical: 14,
  },
  likeBtnCount: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  readingTitulo: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 16,
  },
  readingTexto: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 25,
  },
});
