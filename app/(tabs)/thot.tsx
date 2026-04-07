import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { getSecure, SecureKeys, setSecure } from '@/lib/secureStorage';
import { safeParse, SavedConvosSchema } from '@/lib/schemas';
import { sendChatMessage, sendDesafioMessage } from '@/lib/thotApi';
import * as Haptics from 'expo-haptics';
import {
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const THOT_CONVOS_KEY = 'thot_convos';
const THOT_DESAFIO_KEY = 'thot_desafio_date';

// ─── Types ───────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

type Desafio = {
  id: string;
  titulo: string;
  contexto: string;
};

type SavedConvo = {
  id: string;
  createdAt: number;
  messages: Message[];
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const DESAFIOS: Desafio[] = [
  {
    id: '1',
    titulo: 'Historia en 100 palabras',
    contexto:
      'Este desafío te invita a contar una historia completa —con inicio, nudo y desenlace— usando exactamente 100 palabras. La restricción te obliga a elegir cada palabra con precisión, eliminando lo innecesario y potenciando lo esencial. Es ideal para entrenar la concisión y descubrir que menos puede ser mucho más.',
  },
  {
    id: '2',
    titulo: 'Diálogo inesperado',
    contexto:
      'Escribe únicamente diálogo, sin narración ni descripciones. Dos personajes se encuentran en un lugar que ninguno de los dos esperaba. El reto está en revelar quiénes son, qué sienten y qué quieren solo a través de sus palabras. Perfecto para trabajar la voz de los personajes y la tensión dramática.',
  },
  {
    id: '3',
    titulo: 'El objeto que habla',
    contexto:
      'Elige un objeto cotidiano —una silla, un reloj, una llave— y escribe un monólogo en primera persona desde su punto de vista. ¿Qué ha visto? ¿Qué siente? Este ejercicio desarrolla la empatía narrativa y te entrena para encontrar perspectivas originales en lo mundano.',
  },
  {
    id: '4',
    titulo: 'Reescribe el final',
    contexto:
      'Toma un cuento clásico que conozcas bien y reescribe su final de una forma completamente inesperada. Puedes cambiarlo radicalmente o darle un giro sutil que lo resignifique todo. Este ejercicio trabaja la creatividad estructural y te ayuda a desafiar los clichés narrativos que llevamos interiorizados.',
  },
];

function makeInitialMessages(): Message[] {
  return [{ id: 'init', role: 'assistant', text: 'Hola Raúl! ¿Qué te apetece hacer hoy?' }];
}

// ─── Conversations Sidebar ────────────────────────────────────────────────────

function ConvosSidebar({
  convos,
  activeId,
  onSelect,
  onDelete,
  onClose,
}: {
  convos: SavedConvo[];
  activeId: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(-280)).current;
  const [longPressedId, setLongPressedId] = useState<string | null>(null);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, []);

  function handleClose() {
    Animated.timing(slideAnim, {
      toValue: -280,
      duration: 240,
      useNativeDriver: true,
    }).start(() => onClose());
  }

  function getTitle(convo: SavedConvo) {
    const first = convo.messages.find((m) => m.role === 'user');
    if (first) return first.text.length > 45 ? first.text.slice(0, 45) + '…' : first.text;
    return 'Nueva conversación';
  }

  return (
    <>
      <TouchableOpacity
        style={styles.sidebarBackdrop}
        activeOpacity={1}
        onPress={handleClose}
      />
      <Animated.View style={[styles.sidebarPanel, { transform: [{ translateX: slideAnim }] }]}>
        <SafeAreaView style={styles.flex} edges={['top', 'left', 'bottom']}>
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>Conversaciones</Text>
          </View>
          <FlatList
            data={convos}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.sidebarList}
            renderItem={({ item }) => (
              <View style={styles.sidebarItem}>
                <TouchableOpacity
                  style={styles.flex}
                  onPress={() => {
                    if (longPressedId === item.id) { setLongPressedId(null); return; }
                    onSelect(item.id); handleClose();
                  }}
                  onLongPress={() => setLongPressedId(item.id)}
                  delayLongPress={400}>
                  <View style={[
                    styles.sidebarItemInner,
                    item.id === activeId && styles.sidebarItemPill,
                    item.id === longPressedId && styles.sidebarItemLongPressed,
                  ]}>
                    <Text style={styles.sidebarItemTitle} numberOfLines={2}>{getTitle(item)}</Text>
                    {longPressedId === item.id && (
                      <TouchableOpacity
                        style={styles.sidebarDeleteInline}
                        onPress={() => { onDelete(item.id); setLongPressedId(null); }}>
                        <MaterialIcons name="delete-outline" size={15} color="#e05c5c" />
                        <Text style={styles.sidebarDeleteText}>Eliminar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.sidebarEmpty}>Sin conversaciones guardadas.</Text>
            }
          />
        </SafeAreaView>
      </Animated.View>
</>
  );
}

// ─── Shared: conversation UI ──────────────────────────────────────────────────

function Conversation({
  messages,
  input,
  onChangeInput,
  onSend,
  loading,
  bottomSlot,
}: {
  messages: Message[];
  input: string;
  onChangeInput: (v: string) => void;
  onSend: () => void;
  loading?: boolean;
  bottomSlot?: React.ReactNode;
}) {
  const listRef = useRef<FlatList>(null);

  // Auto-scroll cada vez que cambian los mensajes (incluye actualizaciones de streaming)
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 16);
    }
  }, [messages]);

  return (
    <>
      <FlatList
        ref={listRef}
        style={styles.flex}
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messageList}
        renderItem={({ item }) =>
          item.role === 'user' ? (
            <View style={styles.userBubbleRow}>
              <View style={styles.userBubble}>
                <Text style={styles.userBubbleText}>{item.text}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.assistantRow}>
              {!item.text && loading && item.id === messages[messages.length - 1]?.id ? (
                <Text style={styles.typingIndicator}>Thot está pensando…</Text>
              ) : (
                <Text style={styles.assistantText}>{item.text}</Text>
              )}
            </View>
          )
        }
      />
      {bottomSlot}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={onChangeInput}
          placeholder="Escribe algo..."
          placeholderTextColor={Colors.textMuted}
          multiline
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!input.trim() || loading) && styles.sendButtonDisabled]}
          onPress={onSend}
          disabled={!input.trim() || loading}>
          <MaterialIcons name="send" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>
    </>
  );
}

// ─── Desafíos Tab ─────────────────────────────────────────────────────────────

const INITIAL_DESAFIO_MSGS: Message[] = [
  { id: 'd0', role: 'assistant', text: 'Aquí tienes tus desafíos de hoy. Pulsa uno para que te explique cómo abordarlo.' },
];

function DesafiosTab() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_DESAFIO_MSGS);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeDesafio, setActiveDesafio] = useState<Desafio | null>(null);

  // Reset each new day
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    AsyncStorage.getItem(THOT_DESAFIO_KEY)
      .then((stored) => {
        if (stored !== today) {
          setMessages(INITIAL_DESAFIO_MSGS);
          setInput('');
          setActiveDesafio(null);
          AsyncStorage.setItem(THOT_DESAFIO_KEY, today).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  function selectDesafio(d: Desafio) {
    setActiveDesafio(d);
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: 'user', text: d.titulo },
      { id: (Date.now() + 1).toString(), role: 'assistant', text: d.contexto },
    ]);
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    setInput('');

    const aiId = (Date.now() + 1).toString();
    setMessages([...withUser, { id: aiId, role: 'assistant', text: '' }]);
    setLoading(true);

    let fullText = '';
    try {
      await sendDesafioMessage(withUser, (chunk) => {
        fullText = chunk;
        setMessages((prev) =>
          prev.map((m) => (m.id === aiId ? { ...m, text: fullText } : m))
        );
        Haptics.selectionAsync();
      }, activeDesafio?.contexto);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiId
            ? { ...m, text: 'No pude conectar con el servidor. Comprueba tu conexión.' }
            : m
        )
      );
    } finally {
      setLoading(false);
    }
  }

  const challengeCards = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.desafiosScroll}
      style={styles.desafiosScrollView}>
      {DESAFIOS.map((d) => (
        <TouchableOpacity
          key={d.id}
          style={[styles.desafioCard, activeDesafio?.id === d.id && styles.desafioCardActive]}
          activeOpacity={0.75}
          onPress={() => selectDesafio(d)}>
          <Text style={styles.desafioTitulo}>{d.titulo}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );

  return (
    <Conversation
      messages={messages}
      input={input}
      onChangeInput={setInput}
      onSend={send}
      loading={loading}
      bottomSlot={challengeCards}
    />
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ThotScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'chat' | 'desafios'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [convos, setConvos] = useState<SavedConvo[]>([]);
  const [activeConvoId, setActiveConvoId] = useState(() => Date.now().toString());
  const [chatMessages, setChatMessages] = useState<Message[]>(makeInitialMessages());
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Close sidebar when navigating to another tab
  useEffect(() => {
    const unsub = navigation.addListener('blur', () => setSidebarOpen(false));
    return unsub;
  }, [navigation]);

  // Keep a ref to convos to avoid stale closures inside async callbacks
  const convosRef = useRef<SavedConvo[]>([]);
  useEffect(() => { convosRef.current = convos; }, [convos]);

  useEffect(() => {
    AsyncStorage.getItem(THOT_CONVOS_KEY).then((json) => {
      const saved = safeParse(SavedConvosSchema, json);
      if (!saved || saved.length === 0) return;
      convosRef.current = saved;
      setConvos(saved);
      setActiveConvoId(saved[0].id);
      setChatMessages(saved[0].messages);
    }).catch(() => {});
  }, []);

  function persistConvo(id: string, msgs: Message[]) {
    if (msgs.length <= 1) return;
    const prev = convosRef.current;
    const exists = prev.find((c) => c.id === id);
    let updated: SavedConvo[];
    if (exists) {
      updated = prev.map((c) => c.id === id ? { ...c, messages: msgs } : c);
    } else {
      updated = [{ id, createdAt: parseInt(id), messages: msgs }, ...prev];
    }
    convosRef.current = updated;
    setConvos(updated);
    AsyncStorage.setItem(THOT_CONVOS_KEY, JSON.stringify(updated)).catch(() => {});
  }

  async function sendChat() {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
    const withUser = [...chatMessages, userMsg];
    setChatMessages(withUser);
    setChatInput('');
    persistConvo(activeConvoId, withUser);

    // Creamos el mensaje vacío del asistente que iremos rellenando
    const aiId = (Date.now() + 1).toString();
    const aiMsg: Message = { id: aiId, role: 'assistant', text: '' };
    setChatMessages([...withUser, aiMsg]);
    setChatLoading(true);

    let fullText = '';
    try {
      await sendChatMessage(withUser, (chunk) => {
        fullText = chunk;
        setChatMessages((prev) =>
          prev.map((m) => (m.id === aiId ? { ...m, text: fullText } : m))
        );
        Haptics.selectionAsync();
      });
      // Haptic suave al terminar de escribir
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const finalMessages = [...withUser, { id: aiId, role: 'assistant' as const, text: fullText }];
      persistConvo(activeConvoId, finalMessages);
    } catch {
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === aiId
            ? { ...m, text: 'No pude conectar con el servidor. Comprueba tu conexión.' }
            : m
        )
      );
    } finally {
      setChatLoading(false);
    }
  }

  function newConvo() {
    const id = Date.now().toString();
    setActiveConvoId(id);
    setChatMessages(makeInitialMessages());
    setChatInput('');
    setActiveTab('chat');
    setSidebarOpen(false);
  }

  function deleteConvo(id: string) {
    const updated = convosRef.current.filter((c) => c.id !== id);
    convosRef.current = updated;
    setConvos(updated);
    AsyncStorage.setItem(THOT_CONVOS_KEY, JSON.stringify(updated)).catch(() => {});
    // Si se borra la conversación activa, abre una nueva
    if (id === activeConvoId) {
      newConvo();
    }
  }

  function loadConvo(id: string) {
    const convo = convosRef.current.find((c) => c.id === id);
    if (!convo) return;
    setActiveConvoId(id);
    setChatMessages(convo.messages);
    setChatInput('');
    setActiveTab('chat');
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity hitSlop={8} onPress={() => setSidebarOpen(true)}>
          <MaterialIcons name="menu" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.wordmark}>thot</Text>
        <TouchableOpacity hitSlop={8} onPress={newConvo}>
          <MaterialIcons name="add" size={26} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Pill tabs */}
      <View style={styles.pillTabs}>
        <TouchableOpacity
          style={[styles.pill, activeTab === 'chat' && styles.pillActive]}
          onPress={() => setActiveTab('chat')}>
          <Text style={[styles.pillText, activeTab === 'chat' && styles.pillTextActive]}>
            Chat
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pill, activeTab === 'desafios' && styles.pillActive]}
          onPress={() => setActiveTab('desafios')}>
          <Text style={[styles.pillText, activeTab === 'desafios' && styles.pillTextActive]}>
            Desafío Diario
          </Text>
        </TouchableOpacity>
      </View>

      {/* Each tab is always mounted to preserve independent state */}
      <View style={[styles.flex, activeTab !== 'chat' && styles.hidden]}>
        <Conversation
          messages={chatMessages}
          input={chatInput}
          onChangeInput={setChatInput}
          onSend={sendChat}
          loading={chatLoading}
        />
      </View>
      <View style={[styles.flex, activeTab !== 'desafios' && styles.hidden]}>
        <DesafiosTab />
      </View>

      {/* Conversations sidebar */}
      {sidebarOpen && (
        <ConvosSidebar
          convos={convos}
          activeId={activeConvoId}
          onSelect={loadConvo}
          onDelete={deleteConvo}
          onClose={() => setSidebarOpen(false)}
        />
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hidden: { display: 'none' },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  wordmark: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -0.5,
  },
  pillTabs: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  pill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.text,
  },
  pillActive: {
    backgroundColor: Colors.text,
  },
  pillText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  pillTextActive: {
    color: Colors.background,
  },
  messageList: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 32,
  },
  userBubbleRow: {
    alignItems: 'flex-end',
  },
  userBubble: {
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: '80%',
  },
  userBubbleText: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  assistantRow: {},
  assistantText: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  // Input — same style as messages chat
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
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1f566b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  typingIndicator: {
    color: Colors.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  cursor: {
    color: Colors.textMuted,
    fontSize: 15,
  },
  desafioCardActive: {
    borderColor: '#1f566b',
    backgroundColor: 'rgba(31,86,107,0.15)',
  },
  desafiosScrollView: {
    flexGrow: 0,
  },
  desafiosScroll: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 8,
  },
  desafioCard: {
    width: 160,
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  desafioTitulo: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  // Sidebar
  sidebarBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sidebarPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    backgroundColor: Colors.background,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  sidebarHeader: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sidebarTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -0.5,
  },
  sidebarList: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  sidebarItem: {
    paddingVertical: 3,
  },
  sidebarItemLongPressed: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sidebarDeleteInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sidebarDeleteText: {
    color: '#e05c5c',
    fontSize: 13,
    fontWeight: '500',
  },
  sidebarItemInner: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  sidebarItemPill: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sidebarItemTitle: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  sidebarItemDate: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  sidebarEmpty: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
});
