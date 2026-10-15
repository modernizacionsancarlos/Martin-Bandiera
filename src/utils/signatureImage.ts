/**
 * Firma compacta para guardar dentro del parte de campo.
 *
 * En un celular el lienzo de firma puede medir miles de píxeles (alta densidad de pantalla) y generar un PNG de
 * cientos de KB. Acá se reduce a un máximo de 400 x 160 px, sobre fondo blanco, y se elige el formato más liviano.
 * Una firma queda típicamente entre 5 y 25 KB, muy por debajo del límite de 1 MB de un documento de Firestore.
 */
export const SIGNATURE_MAX_WIDTH = 400;
export const SIGNATURE_MAX_HEIGHT = 160;
/** Tope de tamaño del texto de la firma (las reglas de Firestore rechazan un parte con una firma mayor). */
export const SIGNATURE_MAX_CHARS = 100_000;

export function exportSignature(source: HTMLCanvasElement): string {
  const scale = Math.min(1, SIGNATURE_MAX_WIDTH / source.width, SIGNATURE_MAX_HEIGHT / source.height);
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(source.width * scale));
  out.height = Math.max(1, Math.round(source.height * scale));
  const ctx = out.getContext('2d');
  if (!ctx) return source.toDataURL('image/png');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, out.width, out.height);

  const png = out.toDataURL('image/png');
  if (png.length <= SIGNATURE_MAX_CHARS * 0.5) return png;
  // Si el trazo es muy complejo, JPEG es más liviano; si aun así supera el tope, se baja la calidad.
  for (const quality of [0.7, 0.5, 0.35]) {
    const jpeg = out.toDataURL('image/jpeg', quality);
    if (jpeg.length <= SIGNATURE_MAX_CHARS * 0.8) return jpeg;
  }
  return out.toDataURL('image/jpeg', 0.2);
}
