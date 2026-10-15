import { GoogleGenAI, Type } from '@google/genai';

/**
 * Lectura de remitos manuscritos con Gemini. La usan el endpoint del escáner de la aplicación
 * y los canales de entrada (WhatsApp y Drive).
 */
export class OcrError extends Error {
  constructor(message: string, public status = 503) {
    super(message);
  }
}

export interface ScanInput {
  base64: string;
  mimeType: string;
  knownClients?: string[];
  knownWorkers?: string[];
}

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export async function scanRemitoImage(ai: GoogleGenAI, input: ScanInput): Promise<unknown> {
  const { base64: base64Data, knownClients = [], knownWorkers = [] } = input;
  const mimeType = ALLOWED_MIME.includes(input.mimeType) ? input.mimeType : 'image/jpeg';

  const clientHints = Array.isArray(knownClients) && knownClients.length > 0 
    ? `\nClientes / Empresas conocidas en el sistema para referencia: ${knownClients.slice(0, 60).join(', ')}.`
    : '';
  const workerHints = Array.isArray(knownWorkers) && knownWorkers.length > 0 
    ? `\nPersonal / Técnicos registrados para referencia de nombres: ${knownWorkers.slice(0, 60).join(', ')}.`
    : '';

  const systemInstruction = `Eres un asistente especializado en reconocimiento óptico de caracteres (OCR) de alta precisión para digitalizar remitos manuscritos (escritos a mano en papel o talonario físico) para empresas de obras, ingeniería eléctrica y mantenimiento en Argentina.
Analiza con detenimiento la imagen provista y extrae con máxima fidelidad cada campo escrito a mano.
${clientHints}
${workerHints}

Criterios de extracción:
1. remitoPapel: Número de remito en papel o talonario (ej: "0001-0004523", "4523"). Si no se aprecia, dejar en blanco.
2. fecha: Fecha del remito en formato YYYY-MM-DD. Si solo indica día y mes, estima el año actual (2025 o 2026).
3. cliente: Nombre de la empresa, bodega o contratista indicado.
4. ubicacion: Localidad, finca o departamento geográfico (ej: "San Carlos", "Valle de Uco", "Tupungato").
5. puntoTrabajo: Área, máquina o pozo puntual atendido (ej: "Pozo 4", "Tablero General", "Sala de Bombas").
6. descripcion: Transcripción detallada y limpia de todas las tareas y trabajos técnicos realizados anotados en el papel.
7. horaEntrada: Hora de llegada en formato HH:MM (ej: "08:00").
8. horaSalida: Hora de retiro en formato HH:MM (ej: "12:30").
9. horasTrabajadas: Cantidad de horas dedicadas (número flotante, ej: 4.5). Si figuran entrada y salida, calcula las horas.
10. kilometros: Kilómetros de traslado si figuran en el remito.
11. viajes: Cantidad de viajes (por defecto 1 si hubo traslado, o 0 si no hubo).
12. esGuardia: true si especifica guardia, urgencia, o fuera de horario; de lo contrario false.
13. tecnicoLider: Nombre del técnico a cargo o firmante del remito.
14. cuadrilla: Lista de los demás operarios, ayudantes u oficiales que participaron con su nombre y rol deducido ("Oficial" o "Ayudante").
15. materiales: Lista SOLO de los materiales o repuestos escritos en el papel (columna de cantidad o detalle). No deduzcas materiales a partir de la descripción del trabajo: si el papel no los lista, devolvé la lista vacía.
16. observaciones: Comentarios sobre palabras de difícil lectura o notas complementarias.
17. confianzaLectura: Porcentaje estimado (0 a 100) de claridad de la caligrafía manuscrita.
18. cantidadPersonal: Número escrito en el casillero "PERS" (cantidad de personas que trabajaron). Si no figura, dejar vacío.
Nota: en estos talonarios los nombres del personal a veces están escritos junto al casillero "HORA" o en el "ACLARACIÓN" de la firma; incluílos en tecnicoLider y cuadrilla.`;


  let response;
  // Prioritize gemini-3.6-flash which is responsive, high-capacity, and avoids 503 high-demand errors
  const candidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-flash-latest'];
  let lastError: any = null;

  for (const model of candidateModels) {
    // Try up to 2 attempts per candidate model
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Gemini OCR] Trying model ${model} (attempt ${attempt}/2)...`);
        response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
                {
                  text: 'Extrae con exactitud y máxima fidelidad todos los datos de este remito en papel manuscrito y devuélvelos estructurados en JSON.',
                },
              ],
            },
          ],
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                remitoPapel: { type: Type.STRING },
                fecha: { type: Type.STRING },
                cliente: { type: Type.STRING },
                ubicacion: { type: Type.STRING },
                puntoTrabajo: { type: Type.STRING },
                descripcion: { type: Type.STRING },
                horaEntrada: { type: Type.STRING },
                horaSalida: { type: Type.STRING },
                horasTrabajadas: { type: Type.NUMBER },
                kilometros: { type: Type.NUMBER },
                viajes: { type: Type.INTEGER },
                esGuardia: { type: Type.BOOLEAN },
                tecnicoLider: { type: Type.STRING },
                cuadrilla: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      nombre: { type: Type.STRING },
                      rol: { type: Type.STRING, description: 'Oficial o Ayudante' },
                    },
                    required: ['nombre'],
                  },
                },
                materiales: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      descripcion: { type: Type.STRING },
                      cantidad: { type: Type.NUMBER },
                    },
                    required: ['descripcion'],
                  },
                },
                observaciones: { type: Type.STRING },
                confianzaLectura: { type: Type.INTEGER },
                cantidadPersonal: { type: Type.INTEGER },
              },
              required: ['cliente', 'descripcion'],
            },
          },
        });

        if (response?.text) {
          console.log(`[Gemini OCR] Model ${model} succeeded!`);
          break;
        }
      } catch (mErr: any) {
        const errStr = mErr?.message || String(mErr);
        console.warn(`[Gemini OCR] Model ${model} attempt ${attempt} failed:`, errStr.slice(0, 150));
        lastError = mErr;
        // Wait briefly before retrying
        await new Promise(r => setTimeout(r, 600));
      }
    }
    if (response?.text) {
      break;
    }
  }

  if (!response?.text) {
    let cleanMsg = 'El servicio de IA se encuentra momentáneamente saturado. Por favor, reintenta en unos segundos.';
    try {
      if (lastError?.message) {
        const parsed = JSON.parse(lastError.message);
        if (parsed?.error?.message) cleanMsg = parsed.error.message;
      }
    } catch {
      if (typeof lastError?.message === 'string') cleanMsg = lastError.message;
    }
    throw new OcrError(cleanMsg, 503);
  }

  try {
    return JSON.parse(response.text || '{}');
  } catch {
    throw new OcrError('La IA devolvió una respuesta que no se pudo interpretar. Reintente con otra foto.', 502);
  }
}
