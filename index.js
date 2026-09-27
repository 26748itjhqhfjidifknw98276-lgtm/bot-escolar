import { GoogleGenerativeAI } from "@google/generative-ai";
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import express from 'express';
import 'dotenv/config';

// 1. Servidor Express para mantener el bot activo en Render
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Escolar Activo 📚'));
app.listen(port, () => console.log(`Servidor web activo en puerto ${port}`));

// 2. Configuración de Gemini 1.5 Flash
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
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

// 3. Inicialización del cliente de WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null
  }
});

client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
  console.log('Escanea este código QR con WhatsApp:');
});

client.on('ready', () => {
  console.log('¡El Bot Escolar está conectado y listo!');
});

// 4. Procesamiento de mensajes
client.on('message', async (msg) => {
  try {
    const texto = msg.body ? msg.body.trim() : '';

    // CASO 1: GENERACIÓN DE IMÁGENES POR COMANDO (/dibuja o /imagen)
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

    // CASO 2: FOTO DE TAREA O EJERCICIOS (Resolución en texto ordenado)
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

    // CASO 3: CHAT NORMAL (Preguntas vs Bromas)
    if (texto) {
      const mensajeTexto = `[${msg.author || msg.from}]: ${texto}`;
      const result = await chat.sendMessage(mensajeTexto);
      const respuesta = result.response.text().trim();

      // Si Gemini detecta que es broma o charla casual, el bot guarda silencio
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
