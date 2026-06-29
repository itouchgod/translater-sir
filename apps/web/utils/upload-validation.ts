export const ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/webm", "audio/ogg"] as const;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;

export const MAX_AUDIO_SIZE = 500 * 1024 * 1024;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_VIDEO_SIZE = 1024 * 1024 * 1024;
export const MAX_ATTACHMENT_SIZE = 100 * 1024 * 1024;

export type UploadValidationResult =
  | { valid: true; error: null }
  | { valid: false; error: string };

export function validateUpload(
  file: { type: string; size: number },
  allowedTypes: readonly string[],
  maxSize: number,
): UploadValidationResult {
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: "文件类型不支持" };
  }

  if (!Number.isInteger(file.size) || file.size <= 0) {
    return { valid: false, error: "文件大小无效" };
  }

  if (file.size > maxSize) {
    return { valid: false, error: "文件过大" };
  }

  return { valid: true, error: null };
}

export function getAllowedTypesForPurpose(purpose: UploadPurpose) {
  switch (purpose) {
    case "avatar":
      return ALLOWED_IMAGE_TYPES;
    case "audio":
      return ALLOWED_AUDIO_TYPES;
    case "attachment":
      return [...ALLOWED_IMAGE_TYPES, ...ALLOWED_AUDIO_TYPES, ...ALLOWED_VIDEO_TYPES, "application/pdf", "text/plain"];
  }
}

export function getMaxSizeForPurpose(purpose: UploadPurpose) {
  switch (purpose) {
    case "avatar":
      return MAX_IMAGE_SIZE;
    case "audio":
      return MAX_AUDIO_SIZE;
    case "attachment":
      return MAX_ATTACHMENT_SIZE;
  }
}

export type UploadPurpose = "avatar" | "audio" | "attachment";
