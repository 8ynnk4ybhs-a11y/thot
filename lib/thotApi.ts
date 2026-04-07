/**
 * Cliente para el backend de Thot.
 * Recibe la respuesta completa y la revela carácter a carácter para simular streaming.
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

type Message = { id: string; role: 'user' | 'assistant'; text: string };

/** Velocidad de revelado: ms entre cada carácter (más bajo = más rápido). */
const CHAR_DELAY_MS = 12;

/**
 * Revela el texto carácter a carácter llamando a onChunk en cada paso.
 * Devuelve una Promise que resuelve cuando termina.
 */
function revealText(text: string, onChunk: (partial: string) => void): Promise<void> {
  return new Promise((resolve) => {
    let i = 0;
    const tick = () => {
      if (i >= text.length) {
        resolve();
        return;
      }
      // Revelamos de a 2 caracteres por tick para no ser demasiado lento en textos largos
      i = Math.min(i + 2, text.length);
      onChunk(text.slice(0, i));
      setTimeout(tick, CHAR_DELAY_MS);
    };
    tick();
  });
}

async function callApi(endpoint: string, body: object): Promise<string> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if ('error' in data) throw new Error(data.error);
  return data.message as string;
}

/** Envía mensajes al chat de Thot y revela la respuesta progresivamente. */
export async function sendChatMessage(
  messages: Message[],
  onChunk: (partial: string) => void
): Promise<void> {
  const text = await callApi('/api/chat', { messages });
  await revealText(text, onChunk);
}

/** Envía mensajes dentro de un desafío y revela la respuesta progresivamente. */
export async function sendDesafioMessage(
  messages: Message[],
  onChunk: (partial: string) => void,
  desafioContexto?: string
): Promise<void> {
  const text = await callApi('/api/desafio', { messages, desafioContexto });
  await revealText(text, onChunk);
}
