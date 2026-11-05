const MAX_SIDE = 2000;
const MAX_BASE64_LENGTH = 3_500_000; // keeps the JSON body under Vercel's 4.5MB limit

/**
 * Downscales a photo (data URL or raw base64) to a JPEG that fits the upload limit.
 * Non-image files (e.g. PDF) are returned unchanged.
 */
export async function shrinkImageForUpload(input: string, mimeType: string): Promise<{ data: string; mimeType: string }> {
  if (!mimeType.startsWith('image/')) return { data: input, mimeType };
  const dataUrl = input.startsWith('data:') ? input : `data:${mimeType};base64,${input}`;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    el.src = dataUrl;
  });

  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { data: input, mimeType };
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let quality = 0.85;
  let out = canvas.toDataURL('image/jpeg', quality);
  while (out.length > MAX_BASE64_LENGTH && quality > 0.4) {
    quality -= 0.15;
    out = canvas.toDataURL('image/jpeg', quality);
  }
  return { data: out, mimeType: 'image/jpeg' };
}
