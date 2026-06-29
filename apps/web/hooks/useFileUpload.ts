"use client";

import { useCallback, useState } from "react";
import type { UploadPurpose } from "@/utils/upload-validation";

type UploadOptions = {
  key?: string;
  meetingId?: string;
};

type PresignedResponse = {
  uploadUrl: string;
  key: string;
  publicUrl: string;
};

type ConfirmResponse = {
  url: string;
  key: string;
};

async function readApiResponse<T>(response: Response, fallbackMessage: string) {
  const payload = (await response.json()) as {
    data: T | null;
    error: { message: string } | null;
  };

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? fallbackMessage);
  }

  return payload.data;
}

function putFileWithProgress(
  file: File,
  uploadUrl: string,
  onProgress: (progress: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(new Error("文件上传失败"));
    });

    xhr.addEventListener("error", () => {
      reject(new Error("文件上传失败"));
    });

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

export function useFileUpload() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File, purpose: UploadPurpose, options: UploadOptions = {}) => {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        const presignedResponse = await fetch("/api/upload/presigned", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            key: options.key,
            fileName: file.name,
            contentType: file.type,
            fileSize: file.size,
            purpose,
            meetingId: options.meetingId,
          }),
        });
        const presigned = await readApiResponse<PresignedResponse>(
          presignedResponse,
          "创建上传链接失败",
        );

        await putFileWithProgress(file, presigned.uploadUrl, setUploadProgress);

        const confirmResponse = await fetch("/api/upload/confirm", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            key: presigned.key,
            purpose,
            meetingId: options.meetingId,
            fileName: file.name,
          }),
        });
        const confirmed = await readApiResponse<ConfirmResponse>(
          confirmResponse,
          "确认上传失败",
        );

        setUploadProgress(100);

        return {
          url: confirmed.url ?? presigned.publicUrl,
          key: confirmed.key ?? presigned.key,
        };
      } catch (caught: unknown) {
        const message = caught instanceof Error ? caught.message : "文件上传失败";
        setError(message);
        throw new Error(message);
      } finally {
        setIsUploading(false);
      }
    },
    [],
  );

  return {
    upload,
    uploadProgress,
    isUploading,
    error,
  };
}
