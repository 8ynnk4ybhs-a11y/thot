import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatsMapSchema, FollowingIdsSchema, LikedIdsSchema, safeParse, UserGenresSchema } from '@/lib/schemas';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const HOME_LIKED_KEY = 'thot_home_liked';
const HOME_FOLLOWING_KEY = 'thot_home_following';
const USER_GENRES_KEY = 'thot_user_genres';
export const CHATS_KEY = 'thot_chats';

const GENRES = [
  'Terror', 'Fantasía', 'Romance', 'Ciencia ficción',
  'Misterio', 'Aventura', 'Drama', 'Histórica',
  'Poesía', 'Thriller', 'Comedia', 'Distopía',
];

type ChatMsg = { id: string; role: 'me' | 'other'; text: string };

const INITIAL_FOLLOWERS: Record<string, number> = {
  elena_writes: 312,
  'marcos.r': 87,
  'sofía_narrativa': 540,
  javi_cuentos: 194,
  'luna.prose': 1203,
};

type Story = {
  id: string;
  autor: string;
  titulo: string;
  sinopsis: string;
  capitulos: { id: string; contenido: string }[];
  likes: number;
  genero?: string;
};

// Full story pool — feed is drawn from this and sorted by recommendation score
const ALL_STORIES: Story[] = [
  {
    id: 'h1',
    autor: 'elena_writes',
    titulo: 'El último mapa',
    sinopsis: 'Una cartógrafa descubre que el mapa que lleva dibujando toda su vida conduce a un lugar que no debería existir. Cada línea que traza la acerca más al borde de lo conocido.',
    capitulos: [
      { id: 'h1c1', contenido: 'Llevo veinte años dibujando mapas de ciudades que otros han olvidado. Pero este mapa, el que apareció bajo las tablas del suelo de mi estudio, no lo he dibujado yo.' },
      { id: 'h1c2', contenido: 'Seguí las coordenadas tres noches seguidas. La cuarta noche, el camino ya no estaba donde el mapa decía. El mapa había cambiado.' },
    ],
    likes: 87,
    genero: 'Misterio',
  },
  {
    id: 'h2',
    autor: 'marcos.r',
    titulo: 'Ruido blanco',
    sinopsis: 'En una ciudad donde nadie recuerda haber soñado, un técnico de sonido empieza a escuchar voces en las frecuencias que nadie debería oír.',
    capitulos: [],
    likes: 34,
    genero: 'Terror',
  },
  {
    id: 'h3',
    autor: 'sofía_narrativa',
    titulo: 'La traductora',
    sinopsis: 'Traducir no es solo cambiar palabras. Es habitar otra mente. Y algunas mentes no deberían habitarse.',
    capitulos: [
      { id: 'h3c1', contenido: 'El manuscrito llegó sin remitente. Estaba escrito en un idioma que no existía en ningún registro, pero que yo entendía perfectamente desde el primer párrafo.' },
      { id: 'h3c2', contenido: 'Cuando terminé el tercer capítulo empecé a pensar en un idioma que no era el mío. Cuando terminé el séptimo, ya no recordaba cuál era el mío.' },
      { id: 'h3c3', contenido: 'El editor me preguntó quién era el autor. Le dije que no lo sabía. Me miró como si fuera la respuesta más honesta que había escuchado en años.' },
    ],
    likes: 152,
    genero: 'Misterio',
  },
  {
    id: 'h4',
    autor: 'javi_cuentos',
    titulo: 'Instrucciones para desaparecer',
    sinopsis: 'Un manual de instrucciones encontrado en un cajón explica, paso a paso, cómo volverse invisible para los demás. El problema es que funciona.',
    capitulos: [
      { id: 'h4c1', contenido: 'Paso uno: deja de responder preguntas que nadie te ha hecho. Paso dos: camina por el lado derecho de la acera, siempre el derecho. Paso tres: nunca mires a los ojos a alguien que lleve sombrero.' },
    ],
    likes: 61,
    genero: 'Fantasía',
  },
  {
    id: 'h5',
    autor: 'luna.prose',
    titulo: 'Correspondencia',
    sinopsis: 'Dos escritores que nunca se han visto se escriben cartas durante cuarenta años. Solo al final descubren que siempre vivieron en el mismo edificio.',
    capitulos: [],
    likes: 209,
    genero: 'Drama',
  },
  {
    id: 'h6',
    autor: 'elena_writes',
    titulo: 'Cartas sin destinatario',
    sinopsis: 'Una mujer empieza a recibir cartas dirigidas a alguien que murió en su apartamento treinta años antes. Las cartas están escritas hoy.',
    capitulos: [
      { id: 'h6c1', contenido: 'La primera carta llegó un martes. Nombre correcto, dirección correcta, pero mi nombre no era ese. Pensé en devolverla. No lo hice.' },
    ],
    likes: 43,
    genero: 'Terror',
  },
  {
    id: 'h7',
    autor: 'luna.prose',
    titulo: 'El peso del silencio',
    sinopsis: 'En un monasterio abandonado, una escritora encuentra un diario en blanco que, cada mañana, aparece con una nueva entrada que no escribió ella.',
    capitulos: [],
    likes: 167,
    genero: 'Misterio',
  },
  {
    id: 'h8',
    autor: 'marcos.r',
    titulo: 'La otra orilla',
    sinopsis: 'Cada vez que cruza el puente que divide su ciudad, algo cambia. No el paisaje. Él.',
    capitulos: [
      { id: 'h8c1', contenido: 'La primera vez que lo noté fue un miércoles. Crucé el puente de camino al trabajo y al llegar a la oficina nadie me reconoció. Yo sí los reconocí a ellos.' },
      { id: 'h8c2', contenido: 'Aprendí a no cruzar dos veces el mismo día. Pero a veces no hay otra ruta.' },
    ],
    likes: 29,
    genero: 'Fantasía',
  },
  {
    id: 'h9',
    autor: 'sofía_narrativa',
    titulo: 'Memorias de un espejo',
    sinopsis: 'Un espejo antiguo guarda los recuerdos de todos los que se han mirado en él. El problema es que también los devuelve.',
    capitulos: [],
    likes: 98,
    genero: 'Terror',
  },
  {
    id: 'h10',
    autor: 'javi_cuentos',
    titulo: 'El último tren',
    sinopsis: 'El tren de las 23:47 lleva años sin aparecer en los horarios oficiales. Pero sigue llegando a su andén cada noche.',
    capitulos: [
      { id: 'h10c1', contenido: 'Nadie sabe adónde va. Nadie que haya subido ha vuelto para contarlo. Yo llevo seis meses en el andén, cada noche, sin subir.' },
    ],
    likes: 55,
    genero: 'Misterio',
  },
];

// ─── Feed logic ───────────────────────────────────────────────────────────────
// 1. Following → stories from authors the user follows
// 2. No following + user genres → stories matching those genres, sorted by score
// 3. Fallback → full recommendation algorithm

function recommendedSort(stories: Story[], likedIds: Set<string>): Story[] {
  const authorAffinity: Record<string, number> = {};
  for (const id of likedIds) {
    const s = stories.find((x) => x.id === id);
    if (s) authorAffinity[s.autor] = (authorAffinity[s.autor] ?? 0) + 1;
  }
  const maxLikes = Math.max(...stories.map((s) => s.likes), 1);
  return [...stories].sort((a, b) => {
    const scoreA = (authorAffinity[a.autor] ?? 0) * 10 + (a.likes / maxLikes) * 5;
    const scoreB = (authorAffinity[b.autor] ?? 0) * 10 + (b.likes / maxLikes) * 5;
    return scoreB - scoreA;
  });
}

function getDisplayFeed(
  stories: Story[],
  followingIds: Set<string>,
  likedIds: Set<string>,
  userGenres: string[],
): { feed: Story[]; title: string } {
  if (followingIds.size > 0) {
    const followFeed = stories.filter((s) => followingIds.has(s.autor));
    if (followFeed.length > 0) return { feed: followFeed, title: 'siguiendo' };
  }
  if (userGenres.length > 0) {
    const genreFeed = stories.filter((s) => s.genero && userGenres.includes(s.genero));
    if (genreFeed.length > 0) return { feed: recommendedSort(genreFeed, likedIds), title: 'para ti' };
  }
  return { feed: recommendedSort(stories, likedIds), title: 'recomendado' };
}

// ─── Search Overlay ───────────────────────────────────────────────────────────

const SEARCH_PAGE = 5;

function SearchOverlay({
  stories,
  onClose,
  onSelectAutor,
  onLeerStory,
}: {
  stories: Story[];
  onClose: () => void;
  onSelectAutor: (autor: string) => void;
  onLeerStory: (story: Story) => void;
}) {
  const [query, setQuery] = useState('');
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(SEARCH_PAGE);
  const [refreshing, setRefreshing] = useState(false);
  const [shuffled, setShuffled] = useState<Story[]>(
    () => [...stories].sort(() => Math.random() - 0.5),
  );

  const isTyping = query.trim() !== '';
  const authors = [...new Set(stories.map((s) => s.autor))];
  const userResults = isTyping
    ? authors.filter((a) => a.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  const allGenreStories = activeGenre
    ? stories.filter((s) => s.genero === activeGenre)
    : shuffled;
  const visibleStories = allGenreStories.slice(0, visibleCount);
  const hasMore = visibleCount < allGenreStories.length;

  function handleGenreChange(g: string) {
    setActiveGenre(activeGenre === g ? null : g);
    setVisibleCount(SEARCH_PAGE);
  }

  function handleRefresh() {
    setRefreshing(true);
    setActiveGenre(null);
    setVisibleCount(SEARCH_PAGE);
    setShuffled([...stories].sort(() => Math.random() - 0.5));
    setTimeout(() => setRefreshing(false), 400);
  }

  function handleScrollEnd(e: { nativeEvent: { layoutMeasurement: { height: number }; contentOffset: { y: number }; contentSize: { height: number } } }) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (hasMore && layoutMeasurement.height + contentOffset.y >= contentSize.height - 80) {
      setVisibleCount((prev) => Math.min(prev + SEARCH_PAGE, allGenreStories.length));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.background }} edges={['top', 'left', 'right']}>
      {/* Search input */}
      <View style={styles.searchHeader}>
        <TouchableOpacity hitSlop={8} onPress={onClose}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar usuarios..."
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {isTyping ? (
        /* User search results */
        <FlatList
          data={userResults}
          keyExtractor={(a) => a}
          contentContainerStyle={styles.searchList}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.searchResult} onPress={() => onSelectAutor(item)}>
              <View style={styles.miniAvatar} />
              <Text style={styles.searchResultText}>@{item}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.searchEmpty}>Sin resultados para "{query}"</Text>
          }
        />
      ) : (
        /* Genre browse — pills fixed, stories scrollable */
        <View style={{ flex: 1 }}>
          <View style={styles.genrePillsBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.genrePillsRow}>
              {GENRES.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.genrePill, activeGenre === g && styles.genrePillActive]}
                  onPress={() => handleGenreChange(g)}>
                  <Text style={[styles.genrePillText, activeGenre === g && styles.genrePillTextActive]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            onScroll={handleScrollEnd}
            scrollEventThrottle={300}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={Colors.textMuted}
              />
            }>
            <View style={styles.genreStoriesList}>
              {visibleStories.length === 0 ? (
                <Text style={styles.searchEmpty}>Sin historias en este género.</Text>
              ) : (
                visibleStories.map((story) => (
                  <TouchableOpacity key={story.id} activeOpacity={0.85} onPress={() => onLeerStory(story)}>
                    <View style={styles.card}>
                      <Text style={styles.tituloDisplay} numberOfLines={1}>{story.titulo}</Text>
                      {!!story.sinopsis && (
                        <Text style={styles.sinopsisDisplay} numberOfLines={3}>{story.sinopsis}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))
              )}
              {hasMore && (
                <Text style={styles.loadingMore}>Cargando más historias…</Text>
              )}
            </View>
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Chat Overlay ─────────────────────────────────────────────────────────────

function ChatOverlay({
  autor,
  onClose,
}: {
  autor: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [recording, setRecording] = useState(false);
  const listRef = useRef<ScrollView>(null);

  function handleMic() {
    setRecording(true);
    setTimeout(() => {
      setRecording(false);
      setInput('[Audio transcrito]');
    }, 2000);
  }

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
      {/* Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity hitSlop={8} onPress={onClose}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.chatHeaderCenter}>
          <View style={styles.miniAvatar} />
          <Text style={styles.chatHeaderName}>@{autor}</Text>
        </View>
        <View style={styles.headerPlaceholder} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
        <ScrollView
          ref={listRef}
          style={{ flex: 1 }}
          contentContainerStyle={[styles.chatMessages, { flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}>
          {messages.length === 0 && (
            <Text style={styles.chatEmpty}>Empieza la conversación con @{autor}</Text>
          )}
          {messages.map((msg) =>
            msg.role === 'me' ? (
              <View key={msg.id} style={styles.chatBubbleRowMe}>
                <View style={styles.chatBubbleMe}>
                  <Text style={styles.chatBubbleMeText}>{msg.text}</Text>
                </View>
              </View>
            ) : (
              <View key={msg.id} style={styles.chatBubbleRowOther}>
                <View style={styles.miniAvatar} />
                <View style={styles.chatBubbleOther}>
                  <Text style={styles.chatBubbleOtherText}>{msg.text}</Text>
                </View>
              </View>
            )
          )}
        </ScrollView>

        <View style={styles.chatInputRow}>
          <TextInput
            style={styles.chatInput}
            value={input}
            onChangeText={setInput}
            placeholder="Mensaje..."
            placeholderTextColor={Colors.textMuted}
            multiline
          />
          <TouchableOpacity
            style={styles.chatSendBtn}
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

// ─── Story Card ───────────────────────────────────────────────────────────────

function StoryCard({
  story,
  liked,
  following,
  onLeer,
  onAutorPress,
  onToggleFollow,
}: {
  story: Story;
  liked: boolean;
  following: boolean;
  onLeer: () => void;
  onAutorPress: () => void;
  onToggleFollow: () => void;
}) {
  const capCount = story.capitulos.length;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onLeer}>
      <View style={styles.card}>
        {/* Author row */}
        <View style={styles.authorRow}>
          <TouchableOpacity style={styles.authorLeft} onPress={onAutorPress} hitSlop={4}>
            <View style={styles.miniAvatar} />
            <Text style={styles.autorText}>@{story.autor}</Text>
          </TouchableOpacity>
          {!following && (
            <TouchableOpacity style={styles.followBtn} onPress={onToggleFollow} hitSlop={4}>
              <Text style={styles.followBtnText}>Seguir</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Title */}
        <Text style={styles.tituloDisplay} numberOfLines={1}>{story.titulo}</Text>

        {/* Sinopsis */}
        {!!story.sinopsis && (
          <Text style={styles.sinopsisDisplay} numberOfLines={3}>{story.sinopsis}</Text>
        )}

        {/* Footer */}
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
            <Text style={styles.likesCount}>{story.likes}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── User Profile Overlay ─────────────────────────────────────────────────────

function UserProfile({
  autor,
  stories,
  likedIds,
  following,
  followers,
  onClose,
  onToggleFollow,
  onLeer,
  onMensaje,
}: {
  autor: string;
  stories: Story[];
  likedIds: Set<string>;
  following: boolean;
  followers: number;
  onClose: () => void;
  onToggleFollow: () => void;
  onLeer: (story: Story) => void;
  onMensaje: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'recientes' | 'populares'>('recientes');
  const userStories = stories.filter((s) => s.autor === autor);
  const totalLikes = userStories.reduce((sum, s) => sum + s.likes, 0);
  const feed = activeTab === 'populares'
    ? [...userStories].sort((a, b) => b.likes - a.likes)
    : userStories;

  return (
    <SafeAreaView style={styles.readingOverlay} edges={['top', 'left', 'right']}>
      {/* Top bar: ← | username | empty */}
      <View style={styles.profileTopBar}>
        <TouchableOpacity hitSlop={8} onPress={onClose}>
          <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.profileUsername}>{autor}</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Avatar + stats */}
        <View style={styles.profileRow}>
          <View style={styles.avatar} />
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{userStories.length}</Text>
              <Text style={styles.statLabel}>historias</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{followers}</Text>
              <Text style={styles.statLabel}>seguidores</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{totalLikes}</Text>
              <Text style={styles.statLabel}>me gusta</Text>
            </View>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, following ? styles.actionBtnFilled : styles.actionBtnBlue]}
            onPress={onToggleFollow}>
            <Text style={[styles.actionBtnText, following && styles.actionBtnTextFilled]}>
              {following ? 'Siguiendo' : 'Seguir'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onMensaje}>
            <Text style={styles.actionBtnText}>Mensaje</Text>
          </TouchableOpacity>
        </View>

        {/* Feed tabs */}
        <View style={styles.feedTabs}>
          <TouchableOpacity
            style={[styles.feedTab, activeTab === 'recientes' && styles.feedTabActive]}
            onPress={() => setActiveTab('recientes')}>
            <MaterialIcons name="access-time" size={22} color={activeTab === 'recientes' ? Colors.text : Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.feedTab, activeTab === 'populares' && styles.feedTabActive]}
            onPress={() => setActiveTab('populares')}>
            <MaterialIcons name="favorite-border" size={22} color={activeTab === 'populares' ? Colors.text : Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Stories */}
        <View style={styles.profileFeed}>
          {feed.length === 0 ? (
            <Text style={styles.emptyText}>Sin publicaciones.</Text>
          ) : feed.map((story) => {
            const capCount = story.capitulos.length;
            return (
              <TouchableOpacity key={story.id} activeOpacity={0.85} onPress={() => onLeer(story)}>
                <View style={styles.card}>
                  <Text style={styles.tituloDisplay} numberOfLines={1}>{story.titulo}</Text>
                  {!!story.sinopsis && (
                    <Text style={styles.sinopsisDisplay} numberOfLines={3}>{story.sinopsis}</Text>
                  )}
                  <View style={styles.cardFooter}>
                    {capCount > 0 ? (
                      <Text style={styles.capitulosCount}>
                        {capCount} {capCount === 1 ? 'capítulo' : 'capítulos'}
                      </Text>
                    ) : <View />}
                    <View style={styles.likesRow}>
                      <MaterialIcons
                        name={likedIds.has(story.id) ? 'favorite' : 'favorite-border'}
                        size={14}
                        color={likedIds.has(story.id) ? '#e74c3c' : Colors.textMuted}
                      />
                      <Text style={styles.likesCount}>{story.likes}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [stories, setStories] = useState<Story[]>(ALL_STORIES);
  const [loadingStories, setLoadingStories] = useState(true);
  const [visibleCount, setVisibleCount] = useState(5);
  const [refreshing, setRefreshing] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [userGenres, setUserGenres] = useState<string[]>([]);
  const [followersMap, setFollowersMap] = useState<Record<string, number>>({ ...INITIAL_FOLLOWERS });
  const [readingStory, setReadingStory] = useState<Story | null>(null);
  const [readingSource, setReadingSource] = useState<'feed' | 'profile'>('feed');
  const [profileAutor, setProfileAutor] = useState<string | null>(null);
  const [chatAutor, setChatAutor] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const navigation = useNavigation();

  // Carga datos reales desde Supabase al montar
  useEffect(() => {
    // Timeout de seguridad: si la carga tarda más de 5s, mostrar mocks
    const timeout = setTimeout(() => setLoadingStories(false), 5000);

    async function loadData() {
      try {
        // Obtener usuario actual
        const userResult = await supabase.auth.getUser();
        const user = userResult.data?.user ?? null;

        // Cargar historias
        const { data: storiesData } = await supabase
          .from('stories')
          .select('id, titulo, contenido, genero, likes_count, published_at, profiles(nombre)')
          .order('published_at', { ascending: false });

        if (storiesData && storiesData.length > 0) {
          const mapped: Story[] = storiesData.map((s: any) => ({
            id: s.id,
            autor: s.profiles?.nombre ?? 'anónimo',
            titulo: s.titulo ?? '',
            sinopsis: s.contenido ?? '',
            capitulos: [],
            likes: s.likes_count ?? 0,
            genero: s.genero ?? undefined,
          }));
          setStories(mapped);
        }
        // Si storiesData está vacío, conserva ALL_STORIES como fallback

        if (user) {
          // Cargar following IDs desde Supabase
          const { data: followData } = await supabase
            .from('follows')
            .select('following_id')
            .eq('follower_id', user.id);
          if (followData && followData.length > 0) {
            setFollowingIds(new Set(followData.map((f: any) => f.following_id)));
          } else {
            // Fallback a AsyncStorage
            const followingJson = await AsyncStorage.getItem(HOME_FOLLOWING_KEY);
            const following = safeParse(FollowingIdsSchema, followingJson);
            if (following) setFollowingIds(new Set(following));
          }

          // Cargar liked IDs desde Supabase
          const { data: likesData } = await supabase
            .from('likes')
            .select('story_id')
            .eq('user_id', user.id);
          if (likesData && likesData.length > 0) {
            setLikedIds(new Set(likesData.map((l: any) => l.story_id)));
          } else {
            // Fallback a AsyncStorage
            const likedJson = await AsyncStorage.getItem(HOME_LIKED_KEY);
            const liked = safeParse(LikedIdsSchema, likedJson);
            if (liked) setLikedIds(new Set(liked));
          }
        }

        // Cargar géneros del usuario (sigue en AsyncStorage)
        const genresJson = await AsyncStorage.getItem(USER_GENRES_KEY);
        const genres = safeParse(UserGenresSchema, genresJson);
        if (genres) setUserGenres(genres);
      } catch {
        // En caso de error usar datos de AsyncStorage como fallback
        try {
          const [likedJson, followingJson, genresJson] = await Promise.all([
            AsyncStorage.getItem(HOME_LIKED_KEY),
            AsyncStorage.getItem(HOME_FOLLOWING_KEY),
            AsyncStorage.getItem(USER_GENRES_KEY),
          ]);
          const liked = safeParse(LikedIdsSchema, likedJson);
          const following = safeParse(FollowingIdsSchema, followingJson);
          const genres = safeParse(UserGenresSchema, genresJson);
          if (liked) setLikedIds(new Set(liked));
          if (following) setFollowingIds(new Set(following));
          if (genres) setUserGenres(genres);
        } catch {}
      } finally {
        setLoadingStories(false);
      }
    }
    loadData().finally(() => clearTimeout(timeout));
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('tabPress' as any, () => {
      setReadingStory(null);
      setProfileAutor(null);
      setChatAutor(null);
      setVisibleCount(5);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
    return unsub;
  }, [navigation]);

  // Feed — re-computed whenever following/likes/genres change
  const { feed: fullFeed, title: feedTitle } = getDisplayFeed(stories, followingIds, likedIds, userGenres);
  const recommendedFeed = fullFeed.slice(0, visibleCount);
  const hasMore = visibleCount < fullFeed.length;

  function handleRefresh() {
    setRefreshing(true);
    setVisibleCount(5);
    setTimeout(() => setRefreshing(false), 600);
  }

  function handleScrollEnd(e: { nativeEvent: { layoutMeasurement: { height: number }; contentOffset: { y: number }; contentSize: { height: number } } }) {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (hasMore && layoutMeasurement.height + contentOffset.y >= contentSize.height - 80) {
      setVisibleCount((prev) => Math.min(prev + 3, stories.length));
    }
  }

  async function toggleLike(id: string) {
    const alreadyLiked = likedIds.has(id);
    const newLikedIds = new Set(likedIds);
    if (alreadyLiked) newLikedIds.delete(id); else newLikedIds.add(id);
    setLikedIds(newLikedIds);
    setStories((prev) =>
      prev.map((s) => s.id === id ? { ...s, likes: s.likes + (alreadyLiked ? -1 : 1) } : s)
    );
    // Persistir en Supabase
    try {
      const userResult = await supabase.auth.getUser();
      const user = userResult.data?.user ?? null;
      if (user) {
        if (alreadyLiked) {
          await supabase.from('likes').delete().eq('user_id', user.id).eq('story_id', id);
        } else {
          await supabase.from('likes').insert({ user_id: user.id, story_id: id });
        }
      }
    } catch {}
    // Fallback AsyncStorage
    AsyncStorage.setItem(HOME_LIKED_KEY, JSON.stringify([...newLikedIds])).catch(() => {});
  }

  async function toggleFollow(autor: string) {
    const alreadyFollowing = followingIds.has(autor);
    const newFollowingIds = new Set(followingIds);
    if (alreadyFollowing) newFollowingIds.delete(autor); else newFollowingIds.add(autor);
    setFollowingIds(newFollowingIds);
    setFollowersMap((prev) => ({
      ...prev,
      [autor]: (prev[autor] ?? 0) + (alreadyFollowing ? -1 : 1),
    }));
    // Persistir en Supabase
    try {
      const userResult = await supabase.auth.getUser();
      const user = userResult.data?.user ?? null;
      if (user) {
        if (alreadyFollowing) {
          await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', autor);
        } else {
          await supabase.from('follows').insert({ follower_id: user.id, following_id: autor });
        }
      }
    } catch {}
    // Fallback AsyncStorage
    AsyncStorage.setItem(HOME_FOLLOWING_KEY, JSON.stringify([...newFollowingIds])).catch(() => {});
  }

  if (loadingStories) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ActivityIndicator style={{ flex: 1 }} color={Colors.textMuted} />
      </SafeAreaView>
    );
  }

  if (chatAutor) {
    return <ChatOverlay autor={chatAutor} onClose={() => setChatAutor(null)} />;
  }

  if (searchOpen) {
    return (
      <SearchOverlay
        stories={stories}
        onClose={() => setSearchOpen(false)}
        onSelectAutor={(autor) => { setSearchOpen(false); setProfileAutor(autor); }}
        onLeerStory={(story) => { setSearchOpen(false); setReadingSource('feed'); setReadingStory(story); }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity hitSlop={8} onPress={() => setSearchOpen(true)}>
          <MaterialIcons name="search" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.wordmark}>{feedTitle}</Text>
        <TouchableOpacity hitSlop={8} onPress={() => router.push('/nueva-historia')}>
          <MaterialIcons name="edit" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Feed */}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScrollEnd}
        scrollEventThrottle={300}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.textMuted}
          />
        }>
        {recommendedFeed.length === 0 && (
          <Text style={styles.emptyFeed}>
            {feedTitle === 'siguiendo'
              ? 'Las personas que sigues aún no han publicado historias.'
              : 'No hay historias disponibles.'}
          </Text>
        )}
        {recommendedFeed.map((story) => (
          <StoryCard
            key={story.id}
            story={story}
            liked={likedIds.has(story.id)}
            following={followingIds.has(story.autor)}
            onLeer={() => { setReadingSource('feed'); setReadingStory(story); }}
            onAutorPress={() => setProfileAutor(story.autor)}
            onToggleFollow={() => toggleFollow(story.autor)}
          />
        ))}
        {hasMore && (
          <Text style={styles.loadingMore}>Cargando más historias…</Text>
        )}
      </ScrollView>

      {/* User profile overlay */}
      {profileAutor && (
        <UserProfile
          autor={profileAutor}
          stories={stories}
          likedIds={likedIds}
          following={followingIds.has(profileAutor)}
          followers={followersMap[profileAutor] ?? 0}
          onClose={() => setProfileAutor(null)}
          onToggleFollow={() => toggleFollow(profileAutor)}
          onLeer={(story) => { setReadingSource('profile'); setReadingStory(story); }}
          onMensaje={() => setChatAutor(profileAutor)}
        />
      )}

      {/* Reading overlay */}
      {readingStory && (
        <SafeAreaView style={styles.readingOverlay} edges={['top', 'left', 'right']}>
          <View style={styles.overlayHeader}>
            <TouchableOpacity hitSlop={8} onPress={() => { setReadingStory(null); if (readingSource === 'feed') setProfileAutor(null); }}>
              <MaterialIcons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.headerPlaceholder} />
          </View>
          <ScrollView contentContainerStyle={styles.overlayScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.overlayCard}>
              {/* Author row — solo desde el feed */}
              {readingSource === 'feed' && (
                <View style={styles.authorRow}>
                  <TouchableOpacity style={styles.authorLeft} onPress={() => { setReadingStory(null); setProfileAutor(readingStory.autor); }} hitSlop={4}>
                    <View style={styles.miniAvatar} />
                    <Text style={styles.autorText}>@{readingStory.autor}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.followBtn, followingIds.has(readingStory.autor) && styles.followBtnActive]}
                    onPress={() => toggleFollow(readingStory.autor)}
                    hitSlop={4}>
                    <Text style={[styles.followBtnText, followingIds.has(readingStory.autor) && styles.followBtnTextActive]}>
                      {followingIds.has(readingStory.autor) ? 'Siguiendo' : 'Seguir'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
              <Text style={styles.readingTitulo}>{readingStory.titulo}</Text>
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
            {(() => {
              const liked = likedIds.has(readingStory.id);
              const current = stories.find((s) => s.id === readingStory.id);
              return (
                <TouchableOpacity style={styles.likeBtn} onPress={() => toggleLike(readingStory.id)}>
                  <MaterialIcons name={liked ? 'favorite' : 'favorite-border'} size={26} color={liked ? '#e74c3c' : Colors.text} />
                  <Text style={styles.likeBtnCount}>{current?.likes ?? readingStory.likes}</Text>
                </TouchableOpacity>
              );
            })()}
          </ScrollView>
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerPlaceholder: { width: 24 },
  wordmark: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -0.5,
  },
  feedContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  loadingMore: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 8,
  },
  emptyFeed: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    lineHeight: 22,
  },
  // Card
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  authorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.border,
  },
  autorText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.text,
  },
  followBtnActive: {
    backgroundColor: Colors.text,
  },
  followBtnText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  followBtnTextActive: {
    color: Colors.background,
  },
  tituloDisplay: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 6,
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
  // Reading overlay
  readingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    flex: 1,
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  overlayScroll: { paddingHorizontal: 16, paddingBottom: 40 },
  overlayCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  readingAutor: { color: Colors.textMuted, fontSize: 12, marginBottom: 6 },
  readingTitulo: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    marginBottom: 16,
  },
  readingTexto: { color: Colors.text, fontSize: 16, lineHeight: 25 },
  capituloBlock: { marginTop: 36 },
  capituloLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  likeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 24,
    paddingVertical: 14,
  },
  likeBtnCount: { color: Colors.text, fontSize: 18, fontWeight: '600' },
  // User profile overlay
  profileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  profileUsername: {
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
  actionBtnFilled: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  actionBtnBlue: {
    backgroundColor: '#1f566b',
    borderColor: '#1f566b',
  },
  actionBtnText: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  actionBtnTextFilled: { color: Colors.background },
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
  profileFeed: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  emptyText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', marginTop: 40 },
  // Chat
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  chatHeaderCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chatHeaderName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  chatMessages: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  chatEmpty: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
  },
  chatBubbleRowMe: { alignItems: 'flex-end' },
  chatBubbleMe: {
    backgroundColor: Colors.text,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '75%',
  },
  chatBubbleMeText: { color: Colors.background, fontSize: 15, lineHeight: 21 },
  chatBubbleRowOther: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  chatBubbleOther: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '75%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chatBubbleOtherText: { color: Colors.text, fontSize: 15, lineHeight: 21 },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  chatInput: {
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
  chatSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1f566b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Search
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: 18,
    color: Colors.text,
    fontSize: 15,
  },
  searchList: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  searchResult: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 14,
  },
  searchResultText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  searchEmpty: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  genrePillsBar: {
    backgroundColor: Colors.background,
  },
  genrePillsRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  genrePill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBackground,
  },
  genrePillActive: {
    backgroundColor: '#1f566b',
    borderColor: '#1f566b',
  },
  genrePillText: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '500',
  },
  genrePillTextActive: {
    color: '#ffffff',
  },
  genreStoriesList: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
});
