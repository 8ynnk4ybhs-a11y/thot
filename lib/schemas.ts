/**
 * Zod schemas — validación en runtime de todos los datos que vienen de AsyncStorage o APIs.
 * Úsalos en lugar de `JSON.parse(x) as Tipo` para garantizar integridad de datos.
 */

import { z } from 'zod';

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const SessionSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  user: z.object({
    id: z.string(),
    email: z.string().email().optional(),
  }),
});

export type Session = z.infer<typeof SessionSchema>;

// ─── Historias / Borradores ───────────────────────────────────────────────────

export const CapituloSchema = z.object({
  id: z.string(),
  contenido: z.string(),
});

export const BorradorSchema = z.object({
  id: z.string(),
  titulo: z.string(),
  sinopsis: z.string(),
  capitulos: z.array(CapituloSchema),
  genero: z.string().optional(),
});

export const BorradoresSchema = z.array(BorradorSchema);

export type Borrador = z.infer<typeof BorradorSchema>;

export const PublishedStorySchema = z.object({
  id: z.string(),
  titulo: z.string(),
  sinopsis: z.string(),
  capitulos: z.array(CapituloSchema),
  likes: z.number().int().min(0),
  genero: z.string().optional(),
});

export const PublishedStoriesSchema = z.array(PublishedStorySchema);

export type PublishedStory = z.infer<typeof PublishedStorySchema>;

// ─── Mensajes / Chats ─────────────────────────────────────────────────────────

export const ChatMsgSchema = z.object({
  id: z.string(),
  role: z.enum(['me', 'other']),
  text: z.string().max(5000),
});

export const ChatsMapSchema = z.record(z.string(), z.array(ChatMsgSchema));

export type ChatMsg = z.infer<typeof ChatMsgSchema>;

// ─── Conversaciones con Thot ──────────────────────────────────────────────────

export const ThotMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  text: z.string(),
});

export const SavedConvoSchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  messages: z.array(ThotMessageSchema),
});

export const SavedConvosSchema = z.array(SavedConvoSchema);

export type SavedConvo = z.infer<typeof SavedConvoSchema>;

// ─── Preferencias de usuario ──────────────────────────────────────────────────

export const UserGenresSchema = z.array(z.string()).max(3);

export const LikedIdsSchema = z.array(z.string());
export const FollowingIdsSchema = z.array(z.string());

// ─── Helper: parseo seguro ───────────────────────────────────────────────────

/**
 * Parsea JSON desde AsyncStorage de forma segura.
 * Devuelve `null` si el string es inválido o no pasa el schema.
 */
export function safeParse<T>(schema: z.ZodType<T>, json: string | null): T | null {
  if (!json) return null;
  try {
    return schema.parse(JSON.parse(json));
  } catch {
    return null;
  }
}
