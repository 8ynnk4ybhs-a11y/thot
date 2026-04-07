-- ============================================================
-- THOT — Migración inicial
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ─── PROFILES ────────────────────────────────────────────────
-- Extiende auth.users con datos públicos del escritor
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      text NOT NULL,
  username    text UNIQUE,
  bio         text,
  avatar_url  text,
  generos     text[] DEFAULT '{}',   -- géneros favoritos (hasta 3)
  created_at  timestamptz DEFAULT now()
);

-- Auto-crear profile al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── STORIES ─────────────────────────────────────────────────
-- Historias publicadas (públicas)
CREATE TABLE public.stories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titulo      text NOT NULL,
  contenido   text NOT NULL,
  genero      text NOT NULL,
  portada_url text,
  likes_count int  NOT NULL DEFAULT 0,
  published_at timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- ─── DRAFTS ──────────────────────────────────────────────────
-- Borradores privados (solo el autor)
CREATE TABLE public.drafts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  autor_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  titulo      text NOT NULL DEFAULT '',
  contenido   text NOT NULL DEFAULT '',
  updated_at  timestamptz DEFAULT now()
);

-- ─── FOLLOWS ─────────────────────────────────────────────────
CREATE TABLE public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);

-- ─── LIKES ───────────────────────────────────────────────────
CREATE TABLE public.likes (
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  story_id   uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);

-- Mantener likes_count sincronizado automáticamente
CREATE OR REPLACE FUNCTION public.update_likes_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.stories SET likes_count = likes_count + 1 WHERE id = NEW.story_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.stories SET likes_count = likes_count - 1 WHERE id = OLD.story_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_likes_count();

-- ─── MESSAGES ────────────────────────────────────────────────
-- Chats directos entre usuarios
CREATE TABLE public.messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text        text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  CHECK (sender_id <> receiver_id)
);

-- Índice para cargar conversación entre dos usuarios rápido
CREATE INDEX ON public.messages (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drafts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages  ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Profiles son públicos" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Usuario edita su propio perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- STORIES
CREATE POLICY "Historias son públicas" ON public.stories
  FOR SELECT USING (true);

CREATE POLICY "Autor crea sus historias" ON public.stories
  FOR INSERT WITH CHECK (auth.uid() = autor_id);

CREATE POLICY "Autor edita sus historias" ON public.stories
  FOR UPDATE USING (auth.uid() = autor_id);

CREATE POLICY "Autor borra sus historias" ON public.stories
  FOR DELETE USING (auth.uid() = autor_id);

-- DRAFTS (solo el autor)
CREATE POLICY "Autor lee sus borradores" ON public.drafts
  FOR SELECT USING (auth.uid() = autor_id);

CREATE POLICY "Autor crea borradores" ON public.drafts
  FOR INSERT WITH CHECK (auth.uid() = autor_id);

CREATE POLICY "Autor edita borradores" ON public.drafts
  FOR UPDATE USING (auth.uid() = autor_id);

CREATE POLICY "Autor borra borradores" ON public.drafts
  FOR DELETE USING (auth.uid() = autor_id);

-- FOLLOWS
CREATE POLICY "Follows son públicos" ON public.follows
  FOR SELECT USING (true);

CREATE POLICY "Usuario puede seguir" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Usuario puede dejar de seguir" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);

-- LIKES
CREATE POLICY "Likes son públicos" ON public.likes
  FOR SELECT USING (true);

CREATE POLICY "Usuario da likes" ON public.likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuario quita likes" ON public.likes
  FOR DELETE USING (auth.uid() = user_id);

-- MESSAGES (solo sender y receiver)
CREATE POLICY "Usuario lee sus mensajes" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Usuario envía mensajes" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Usuario borra sus mensajes enviados" ON public.messages
  FOR DELETE USING (auth.uid() = sender_id);
