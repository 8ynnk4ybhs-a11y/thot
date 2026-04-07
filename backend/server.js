require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── System prompt del agente Thot ───────────────────────────────────────────

const SYSTEM_PROMPT = `Eres Thot, un asistente de escritura creativa para la aplicación Thot. \
Tu misión es ayudar a escritores a mejorar su craft, superar el bloqueo creativo y desarrollar su voz narrativa.

Personalidad:
- Cálido, alentador y directo. Nunca condescendiente.
- Conoces profundamente narrativa, estructura, estilo, géneros literarios y psicología del escritor.
- Hablas siempre en español. Tuteas al usuario.
- Tus respuestas son concisas (máximo 4 párrafos salvo que el usuario pida algo extenso).
- Si el usuario comparte un texto, lo analizas de forma constructiva: señalas lo que funciona primero, luego sugieres mejoras concretas.

Capacidades:
- Ayudar a desarrollar personajes, tramas, mundos y diálogos.
- Revisar y mejorar textos (estilo, ritmo, coherencia, show don't tell).
- Proponer ejercicios creativos adaptados al nivel del usuario.
- Desbloquear la creatividad cuando el usuario no sabe por dónde empezar.
- Explicar técnicas narrativas con ejemplos claros.

Límites:
- No escribas historias completas por el usuario; guíale para que las escriba él.
- Si el usuario pide algo sin relación con la escritura, redirígele amablemente a tu propósito.`;

const DESAFIO_SYSTEM = `${SYSTEM_PROMPT}

Contexto adicional: El usuario está completando un desafío de escritura. \
Cuando responda a su texto, actúa como un coach que da feedback específico y motivador sobre ese ejercicio concreto. \
Si el usuario hace una pregunta sobre el desafío, respóndela directamente.`;

// ─── Validación básica ────────────────────────────────────────────────────────

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  return messages.every(
    (m) =>
      typeof m === 'object' &&
      (m.role === 'user' || m.role === 'assistant') &&
      typeof m.text === 'string' &&
      m.text.trim().length > 0
  );
}

/** Elimina surrogates Unicode sueltos que invalidan el JSON. */
function sanitize(str) {
  return str.replace(/[\uD800-\uDFFF]/g, '');
}

function prepareMessages(messages) {
  const api = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: sanitize(m.text) }));
  const firstUser = api.findIndex((m) => m.role === 'user');
  const trimmed = firstUser >= 0 ? api.slice(firstUser) : api;
  // Máximo 20 mensajes para evitar payloads gigantes
  return trimmed.slice(-20);
}

// ─── Endpoint de chat ─────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!validateMessages(messages)) {
    return res.status(400).json({ error: 'Mensajes inválidos.' });
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: prepareMessages(messages),
    });

    const text = response.content[0]?.text ?? 'Lo siento, no pude generar una respuesta.';
    res.json({ message: text });
  } catch (err) {
    console.error('[Thot] Error en chat:', err.message);
    res.status(500).json({ error: 'Error al procesar tu mensaje. Inténtalo de nuevo.' });
  }
});

// ─── Endpoint de desafío ──────────────────────────────────────────────────────

app.post('/api/desafio', async (req, res) => {
  const { messages, desafioContexto } = req.body;

  if (!validateMessages(messages)) {
    return res.status(400).json({ error: 'Mensajes inválidos.' });
  }

  const systemWithContext = desafioContexto
    ? `${DESAFIO_SYSTEM}\n\nDesafío actual: ${desafioContexto}`
    : DESAFIO_SYSTEM;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemWithContext,
      messages: prepareMessages(messages),
    });

    const text = response.content[0]?.text ?? 'Lo siento, no pude generar una respuesta.';
    res.json({ message: text });
  } catch (err) {
    console.error('[Thot] Error en desafío:', err.message);
    res.status(500).json({ error: 'Error al procesar tu mensaje. Inténtalo de nuevo.' });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true }));

// ─── Inicio ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[Thot] Backend corriendo en http://localhost:${PORT}`);
});
