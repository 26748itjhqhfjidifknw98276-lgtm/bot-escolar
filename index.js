import { GoogleGenerativeAI } from "@google/generative-ai";
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import express from 'express';
import 'dotenv/config';

// 1. Servidor Express para Render
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Escolar Activo 📚'));
app.listen(port, () => console.log(`Servidor web activo en puerto ${port}`));

// Validar API Key
if (!process.env.GEMINI_API_KEY) {
  console.error("❌ ERROR: La variable GEMINI_API_KEY no está configurada en Render.");
}

// 2. Configuración de Gemini 1.5 Flash
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "DUMMY_KEY");
const model = genAI.getGenerativeModel({ 
  model: "gemini-1.5-flash",
  systemInstruction: `
    Eres un asistente escolar experto que analiza mensajes e imágenes de tareas en un grupo de WhatsApp.

    REGLAS PARA FOTOS DE TAREAS/LIBROS:
    1. Analiza la imagen y resuelve los ejercicios EN ORDEN NUMÉRICO (1, 2, 3...).
    2. Usa ESTRICTAMENTE esta estructura para cada ejercicio:

       📌 **Ejercicio [Número]:** [Transcripción exacta de la pregunta o problema]
       ✅ **Respuesta:** [Resultado final, número o letra de la opción correcta]
       💡 **Explicación:** [Explicación o procedimiento breve en máximo 2 renglones]

    3. Si la imagen está borrosa o no se ve bien un ejercicio, indica: "⚠️ Ejercicio [Número] no visible claramente."

    REGLAS PARA MENSAJES DE TEXTO EN EL CHAT:
    1. Si es una duda real sobre materias, tareas, horarios o avisos: responde de forma breve, útil y directa.
    2. Si son bromas, chistes, memes, plática casual, chisme o saludos entre alumnos: responde ÚNICAMENTE con la palabra "SILENCIO".
  `
});

const chat = model.startChat();

// 3. Configuración de WhatsApp Client sin ejecutable estático
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  }
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  console.log('Escanea este código QR con WhatsApp:');
});

client.on('ready', () => {
  console.log('¡El Bot Escolar está conectado y listo!');
});

// 4. Lógica de mensajes
client.on('message', async (msg) => {
  try {
    const texto = msg.body ? msg.body.trim() : '';

    // CASO 1: GENERACIÓN DE IMÁGENES (/dibuja o /imagen)
    if (texto.toLowerCase().startsWith('/dibuja ') || texto.toLowerCase().startsWith('/imagen ')) {
      const promptImagen = texto.replace(/^\/(dibuja|imagen)\s+/i, '').trim();

      if (!promptImagen) {
        await msg.reply('Escribe lo que quieres que dibuje. Ejemplo: `/dibuja un gato en el espacio`');
        return;
      }

      console.log(`Generando imagen para: "${promptImagen}"...`);
      await msg.reply('🎨 Generando imagen, dame un momento...');

      const urlImagen = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptImagen)}?nologo=true`;
      const media = await MessageMedia.fromUrl(urlImagen, { unsafeMime: true });
      await msg.reply(media);
      return;
    }

    // CASO 2: FOTO DE TAREA O EJERCICIOS
    if (msg.hasMedia && (msg.type === 'image' || msg.type === 'sticker')) {
      const media = await msg.downloadMedia();

      if (media) {
        const imageParts = [{
          inlineData: {
            data: media.data,
            mimeType: media.mimetype
          }
        }];

        const prompt = "Resuelve todos los ejercicios presentes en esta imagen en orden y siguiendo el formato establecido.";
        
        console.log('Analizando foto de tarea con Gemini...');
        const result = await model.generateContent([prompt, ...imageParts]);
        const respuesta = result.response.text().trim();

        await msg.reply(respuesta);
        console.log('Respuestas enviadas al grupo.');
      }
      return;
    }

    // CASO 3: CHAT NORMAL
    if (texto) {
      const mensajeTexto = `[${msg.author || msg.from}]: ${texto}`;
      const result = await chat.sendMessage(mensajeTexto);
      const respuesta = result.response.text().trim();

      if (respuesta === 'SILENCIO' || respuesta.includes('SILENCIO')) {
        return;
      }

      await msg.reply(respuesta);
    }

  } catch (error) {
    console.error("Error al procesar el mensaje:", error);
  }
});

client.initialize();
