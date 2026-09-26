import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', (qr) => {
  console.log('--- ESCANEA ESTE CÓDIGO QR EN WHATSAPP ---');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('¡El bot está activo y conectado!');
});

client.on('message', async (message) => {
  const texto = message.body.trim();

  // El bot responderá SOLO si el mensaje inicia con "!profe " o "!tarea "
  if (texto.startsWith('!profe ') || texto.startsWith('!tarea ')) {
    const consulta = texto.replace(/^!(profe|tarea)\s+/, '').trim();

    if (!consulta) return;

    try {
      await message.react('🧠');

      const promptGemini = `
        Un estudiante pregunta: "${consulta}".
        Responde strictly en formato JSON válido con dos campos:
        1. "explicacion": Una explicación pedagógica, breve y clara en español (máximo 120 palabras).
        2. "promptImagen": Una descripción corta en INGLÉS para generar una imagen explicativa o esquema sobre el tema.

        Formato JSON:
        {
          "explicacion": "texto...",
          "promptImagen": "educational diagram of..."
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        config: { responseMimeType: "application/json" },
        contents: promptGemini,
      });

      const datos = JSON.parse(response.text);

      // Generación de la imagen en Pollinations.ai
      const promptEncoded = encodeURIComponent(datos.promptImagen);
      const imageUrl = `https://pollinations.ai/p/${promptEncoded}?width=1024&height=1024&seed=${Math.floor(Math.random() * 1000000)}`;

      const media = await MessageMedia.fromUrl(imageUrl);

      await message.reply(media, undefined, {
        caption: `📚 **Respuesta:**\n\n${datos.explicacion}`
      });

    } catch (error) {
      console.error('Error:', error);
      await message.reply('Ocurrió un error al procesar tu duda.');
    }
  }
});

client.initialize();
