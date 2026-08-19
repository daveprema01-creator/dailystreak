/** Downscales an image file to fit within maxDim×maxDim (preserving aspect ratio, center-cropped to square) and re-encodes as webp. */
export function resizeImageToSquareWebp(file: File, maxDim = 256): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = maxDim;
      canvas.height = maxDim;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      ctx.drawImage(img, sx, sy, side, side, 0, 0, maxDim, maxDim);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode image"))),
        "image/webp",
        0.9
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };
    img.src = objectUrl;
  });
}
