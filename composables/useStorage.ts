const MAX_WIDTH = 2400;
const MAX_HEIGHT = 2400;
const QUALITY = 0.88;

/**
 * Compress and convert image to WebP using Canvas API.
 * Resizes to max 2400x2400 while preserving aspect ratio so card text and
 * holo detail stay legible at 2x DPR displays.
 * Returns a compressed File ready for upload.
 */
const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    // Skip if already small enough (under 200KB)
    if (file.size < 200 * 1024) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if larger than max dimensions
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          // Only use compressed version if it's actually smaller
          if (blob.size >= file.size) {
            resolve(file);
            return;
          }

          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, ".webp"),
            { type: "image/webp" },
          );
          resolve(compressedFile);
        },
        "image/webp",
        QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // Fall back to original on error
    };

    img.src = url;
  });
};

// Insert a Cloudinary transformation into an /image/upload/ URL. Lets us
// request a small thumbnail variant for grid tiles instead of always
// downloading the full 1600px upload. Pass-through for non-Cloudinary URLs.
export const cdnUrl = (url: string | undefined, width: number): string => {
  if (!url) return "";
  if (!url.includes("/image/upload/")) return url;
  return url.replace(
    "/image/upload/",
    `/image/upload/w_${width},c_limit,q_auto,f_auto/`,
  );
};

export const useStorage = () => {
  const config = useRuntimeConfig();

  const uploadImage = async (file: File): Promise<string> => {
    // Compress before upload
    const compressed = await compressImage(file);

    const formData = new FormData();
    formData.append("file", compressed);
    formData.append("upload_preset", config.public.cloudinaryUploadPreset);
    formData.append("folder", "poketcg-auctions");

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${config.public.cloudinaryCloudName}/image/upload`,
      { method: "POST", body: formData },
    );

    if (!response.ok) {
      throw new Error("Failed to upload image");
    }

    const data = await response.json();
    return data.secure_url;
  };

  const uploadAuctionImages = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const url = await uploadImage(file);
      urls.push(url);
    }
    return urls;
  };

  return { uploadImage, uploadAuctionImages };
};
