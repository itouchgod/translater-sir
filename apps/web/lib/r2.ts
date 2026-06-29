import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
};

type SignedUploadParams = {
  key: string;
  contentType: string;
  expiresIn?: number;
};

type SignedDownloadParams = {
  key: string;
  expiresIn?: number;
};

export type R2KeyType =
  | "organizationRoot"
  | "avatar"
  | "organizationLogo"
  | "meetingAudio"
  | "meetingAttachment"
  | "meetingExport"
  | "organizationLog";

const MAX_R2_RETRIES = 3;

function getR2Config(): R2Config {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_PUBLIC_URL,
  } = process.env;

  if (
    !R2_ACCOUNT_ID ||
    !R2_ACCESS_KEY_ID ||
    !R2_SECRET_ACCESS_KEY ||
    !R2_BUCKET_NAME
  ) {
    throw new Error("Missing Cloudflare R2 environment variables");
  }

  return {
    accountId: R2_ACCOUNT_ID,
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
    bucketName: R2_BUCKET_NAME,
    publicUrl: R2_PUBLIC_URL,
  };
}

async function withR2Retry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_R2_RETRIES; attempt += 1) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;

      if (attempt < MAX_R2_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 150));
      }
    }
  }

  throw lastError;
}

function createR2Client(config: R2Config) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

function normalizePathSegment(segment: string) {
  return segment
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((part) => part.replace(/[^a-zA-Z0-9._=-]/g, "-"))
    .join("/");
}

export function getR2Key(type: R2KeyType, orgId: string, ...segments: string[]) {
  const safeOrgId = normalizePathSegment(orgId);
  const safeSegments = segments.map(normalizePathSegment).filter(Boolean);

  switch (type) {
    case "organizationRoot":
      return ["organizations", safeOrgId, ...safeSegments].join("/");
    case "avatar":
      return ["organizations", safeOrgId, "avatars", ...safeSegments].join("/");
    case "organizationLogo":
      return ["organizations", safeOrgId, "logos", ...safeSegments].join("/");
    case "meetingAudio":
      return ["organizations", safeOrgId, "meetings", safeSegments[0], "audio", ...safeSegments.slice(1)].join("/");
    case "meetingAttachment":
      return ["organizations", safeOrgId, "meetings", safeSegments[0], "attachments", ...safeSegments.slice(1)].join("/");
    case "meetingExport":
      return ["organizations", safeOrgId, "meetings", safeSegments[0], "exports", ...safeSegments.slice(1)].join("/");
    case "organizationLog":
      return ["organizations", safeOrgId, "logs", ...safeSegments].join("/");
  }
}

function getPublicUrl(config: R2Config, key: string) {
  return config.publicUrl
    ? `${config.publicUrl.replace(/\/$/, "")}/${key.replace(/^\//, "")}`
    : key;
}

export async function uploadToR2(params: {
  key: string;
  body: PutObjectCommandInput["Body"];
  contentType: string;
  metadata?: Record<string, string>;
}) {
  const config = getR2Config();
  const client = createR2Client(config);

  await withR2Retry(() =>
    client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: params.key,
        Body: params.body,
        ContentType: params.contentType,
        Metadata: params.metadata,
      }),
    ),
  );

  return getPublicUrl(config, params.key);
}

export async function getSignedUploadUrl(
  keyOrParams: string | SignedUploadParams,
  contentType?: string,
  expiresIn = 300,
) {
  const params =
    typeof keyOrParams === "string"
      ? { key: keyOrParams, contentType: contentType ?? "", expiresIn }
      : keyOrParams;
  const config = getR2Config();
  const client = createR2Client(config);

  return withR2Retry(() =>
    getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: params.key,
        ContentType: params.contentType,
      }),
      { expiresIn: params.expiresIn ?? 300 },
    ),
  );
}

export function getR2PublicUrl(key: string) {
  const publicUrl = process.env.R2_PUBLIC_URL;

  if (!publicUrl) {
    throw new Error("R2_PUBLIC_URL is required to build public file URLs");
  }

  return `${publicUrl.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

export function getR2KeyFromUrl(urlOrKey: string) {
  const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");

  if (publicUrl && urlOrKey.startsWith(`${publicUrl}/`)) {
    return urlOrKey.slice(publicUrl.length + 1);
  }

  try {
    const parsed = new URL(urlOrKey);
    return parsed.pathname.replace(/^\/+/, "");
  } catch {
    return urlOrKey.replace(/^\/+/, "");
  }
}

export async function getSignedDownloadUrl(
  keyOrParams: string | SignedDownloadParams,
  expiresIn = 300,
) {
  const params = typeof keyOrParams === "string" ? { key: keyOrParams, expiresIn } : keyOrParams;
  const config = getR2Config();
  const client = createR2Client(config);

  return withR2Retry(() =>
    getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: config.bucketName,
        Key: params.key,
      }),
      { expiresIn: params.expiresIn ?? 300 },
    ),
  );
}

export async function headR2Object(key: string) {
  const config = getR2Config();
  const client = createR2Client(config);

  return withR2Retry(() =>
    client.send(
      new HeadObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      }),
    ),
  );
}

export async function deleteFromR2(key: string) {
  const config = getR2Config();
  const client = createR2Client(config);

  await withR2Retry(() =>
    client.send(
      new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      }),
    ),
  );
}
