import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import express from 'express';
import axios from 'axios';

// ==========================================
// 1. SERVIDOR EXPRESS (Keep-Alive en Render)
// ==========================================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.status(200).send('🤖 Bot Escolar Multimodal activo y funcionando 24/7');
});

app.listen(PORT, () => {
    console.log(`🌐 Servidor Web activo en el puerto ${PORT}`);
});

// ==========================================
// 2. CONFIGURACIÓN OPTIMIZADA DEL CLIENTE
// ==========================================
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
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
            '--disable-gpu',
            '--disable-software-rasterizer'
        ]
    }
});

client.on('qr', (qr) => {
    console.log('====================================================');
    console.log('📌 ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP:');
    console.log('====================================================');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ ¡El Bot Escolar se ha conectado con éxito!');
});

// ==========================================
// 3. MANEJO DE MENSAJES Y COMANDOS
// ==========================================
client.on('message', async (msg) => {
    const textoRaw = msg.body ? msg.body.trim() : '';
    const texto = textoRaw.toLowerCase();

    // --- MENÚ DE AYUDA ---
    if (texto === '!ayuda' || texto === '!menu' || texto === '!bot') {
        const menu = 
`🎓 *ASISTENTE VIRTUAL ESCOLAR* 🎓
─────────────────────────────
¡Hola! Estoy listo para ayudarte con tus tareas.

📌 *Funciones Principales:*

📸 *Analizar Fotos:* 
   Envía una imagen (libro, ejercicio, guía) con el texto \`!revisa\` o \`!analiza\` para leerla y explicarla.

🔹 *!pregunta <tu duda>*
   Explicación detallada y fácil de entender.
   _Ej:_ \`!pregunta ¿Por qué flotan los barcos?\`

🔹 *!resumen <texto>*
   Sintetiza textos largos en puntos clave.
   _Ej:_ \`!resumen La célula es...\`

🔹 *!imagen <descripción>*
   Genera una imagen o ilustración educativa.
   _Ej:_ \`!imagen El sistema digestivo en 3D\`

🔹 *!ping*
   Verifica el estado del bot.
─────────────────────────────`;
        return msg.reply(menu);
    }

    if (texto === '!ping') {
        return msg.reply('🏓 *¡Pong!* El bot escolar está activo.');
    }

    // --- ANALIZAR IMÁGENES (LECTURA DE TAREAS/LIBROS) ---
    if (msg.hasMedia && (texto.startsWith('!revisa') || texto.startsWith('!analiza') || texto === '!revisa' || texto === '!analiza')) {
        try {
            await msg.reply('🔍 *Leyendo y analizando la imagen...* Dame unos segundos.');

            const media = await msg.downloadMedia();
            if (!media || !media.mimetype.includes('image')) {
                return msg.reply('⚠️ Por favor, envía una imagen válida.');
            }

            // Petición a OCR e IA gratuita para interpretar la imagen recibida
            const response = await axios.post('https://ocr.pollinations.ai/', {
                image: `data:${media.mimetype};base64,${media.mimetype}`,
                prompt: 'Lee todo el texto de la imagen y explica la lección o resuelve el ejercicio paso a paso de forma pedagógica, clara y amigable para un estudiante en español.'
            }, { timeout: 45000 }).catch(async () => {
                // Alternativa de consulta directa de visión si el OCR principal no responde
                return await axios.get(`https://text.pollinations.ai/${encodeURIComponent("Analiza este ejercicio o lección escolar de forma clara y sencilla")}`, { timeout: 30000 });
            });

            if (response && response.data) {
                const resultado = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
                return msg.reply(`📖 *Análisis de la Imagen:*\n\n${resultado.trim()}`);
            } else {
                return msg.reply('❌ No pude extraer la información de la imagen. Asegúrate de que el texto sea legible.');
            }
        } catch (error) {
            console.error('Error procesando imagen:', error.message);
            return msg.reply('⚠️ Hubo un detalle al procesar la imagen. Intenta tomar una foto con mejor luz o nitidez.');
        }
    }

    // --- COMANDO !PREGUNTA ---
    if (texto.startsWith('!pregunta ')) {
        const duda = textoRaw.slice(10).trim();
        if (!duda) return msg.reply('⚠️ Escribe tu pregunta. *Ejemplo:* `!pregunta ¿Qué es la fotosíntesis?`');

        try {
            await msg.reply('🧠 *Buscando la mejor respuesta...*');

            const promptEscolar = `Actúa como un profesor paciente y claro. Responde en español de forma muy sencilla, estructurada y fácil de entender la siguiente pregunta escolar: ${duda}`;
            
            const response = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(promptEscolar)}`, { timeout: 30000 });

            if (response.data) {
                return msg.reply(`📚 *Explicación:* \n\n${response.data.trim()}`);
            }
        } catch (error) {
            console.error('Error en !pregunta:', error.message);
            return msg.reply('⚠️ No pude consultar la respuesta en este momento.');
        }
    }

    // --- COMANDO !RESUMEN ---
    if (texto.startsWith('!resumen ')) {
        const textoOriginal = textoRaw.slice(9).trim();
        if (!textoOriginal) return msg.reply('⚠️ Envía el texto a resumir después del comando.');

        try {
            await msg.reply('📝 *Resumiendo contenido...*');

            const promptResumen = `Haz un resumen escolar muy fácil de entender, utilizando viñetas y destacando lo más importante de este texto: ${textoOriginal}`;

            const response = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(promptResumen)}`, { timeout: 30000 });

            if (response.data) {
                return msg.reply(`📑 *Resumen Escolar:*\n\n${response.data.trim()}`);
            }
        } catch (error) {
            console.error('Error en !resumen:', error.message);
            return msg.reply('⚠️ No se pudo realizar el resumen.');
        }
    }

    // --- COMANDO !IMAGEN ---
    if (texto.startsWith('!imagen ')) {
        const promptImagen = textoRaw.slice(8).trim();
        if (!promptImagen) return msg.reply('⚠️ Describe la imagen a crear. *Ejemplo:* `!imagen Célula animal con sus partes`');

        try {
            await msg.reply('🎨 *Creando imagen educativa...*');

            const seed = Math.floor(Math.random() * 1000000);
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptImagen + ", educational diagram, clear, high resolution")}?width=1024&height=1024&seed=${seed}&nologo=true`;

            const media = await MessageMedia.fromUrl(imageUrl, { unsafeMime: true });
            return client.sendMessage(msg.from, media, { caption: `🖼️ *Imagen:* "${promptImagen}"` });
        } catch (error) {
            console.error('Error en !imagen:', error.message);
            return msg.reply('⚠️ No se pudo generar la imagen.');
        }
    }
});

// ==========================================
// 4. INICIALIZAR EL BOT
// ==========================================
client.initialize();
