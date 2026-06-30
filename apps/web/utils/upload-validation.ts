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

const IMAGE_MAGIC_BYTES = {
  "image/jpeg": ["ffd8ff"],
  "image/png": ["89504e47"],
  "image/webp": ["52494646"],
} as const;

type ImageContentType = keyof typeof IMAGE_MAGIC_BYTES;

function normalizeMagicBytes(value: string | undefined) {
  return value?.trim().toLowerCase().replace(/[^a-f0-9]/g, "") ?? "";
}

export async function readMagicBytes(file: Blob, byteLength = 12) {
  const buffer = await file.slice(0, byteLength).arrayBuffer();
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function validateMagicBytes(contentType: string, magicBytes: string | undefined): UploadValidationResult {
  if (!(contentType in IMAGE_MAGIC_BYTES)) {
    return { valid: true, error: null };
  }

  const normalized = normalizeMagicBytes(magicBytes);
  const signatures = IMAGE_MAGIC_BYTES[contentType as ImageContentType];

  if (!normalized) {
    return { valid: false, error: "缺少文件签名信息" };
  }

  if (!signatures.some((signature) => normalized.startsWith(signature))) {
    return { valid: false, error: "文件内容与类型不匹配" };
  }

  return { valid: true, error: null };
}

export function validateUpload(
  file: { type: string; size: number; magicBytes?: string },
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

  const magicBytesValidation = validateMagicBytes(file.type, file.magicBytes);
  if (!magicBytesValidation.valid) {
    return magicBytesValidation;
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
