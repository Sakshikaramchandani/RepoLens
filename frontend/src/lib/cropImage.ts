/** Largest input file accepted before cropping (the uploaded result is ~20–60 KB). */
export const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const SIZE = 256;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

export function isAcceptedImage(file: File): boolean {
  return ACCEPTED.includes(file.type);
}

/**
 * Centre-crops an image file to a square, scales it to 256×256 and returns a data URL
 * (WebP where the browser can encode it, JPEG otherwise) — small enough for the 512 KB server limit.
 */
export async function cropToSquare(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("The image could not be read"));
      img.src = url;
    });
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      SIZE,
      SIZE,
    );
    const webp = canvas.toDataURL("image/webp", 0.86);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}
