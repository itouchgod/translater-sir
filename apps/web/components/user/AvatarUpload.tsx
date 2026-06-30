"use client";

import Image from "next/image";
import { CameraIcon, LoaderCircleIcon, UploadCloudIcon } from "lucide-react";
import { ChangeEvent, DragEvent, useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MAX_AVATAR_SIZE_BYTES } from "@/lib/validations/user";
import { readMagicBytes } from "@/utils/upload-validation";

const allowedAvatarTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

type AvatarUploadProps = {
  userId: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
};

type PresignedUploadResponse = {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
};

function getInitials(name: string | null, email: string) {
  const source = name?.trim() || email;
  return source.slice(0, 2).toUpperCase();
}

function assertAvatarFile(file: File) {
  if (!allowedAvatarTypes.has(file.type)) {
    throw new Error("头像仅支持 jpeg、png、webp 格式");
  }

  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    throw new Error("头像不能超过 5MB");
  }
}

async function requestPresignedUpload(file: File) {
  const response = await fetch("/api/upload/presigned", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
      magicBytes: await readMagicBytes(file),
    }),
  });
  const payload = (await response.json()) as {
    data: PresignedUploadResponse | null;
    error: { message: string } | null;
  };

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "创建上传链接失败");
  }

  return payload.data;
}

async function uploadFileToR2(file: File, uploadUrl: string, onProgress: (value: number) => void) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) {
        return;
      }

      onProgress(Math.round((event.loaded / event.total) * 100));
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(new Error("头像上传失败"));
    });

    xhr.addEventListener("error", () => {
      reject(new Error("头像上传失败"));
    });

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

async function confirmAvatarUpload(params: {
  key: string;
  contentType: string;
  sizeBytes: number;
}) {
  const response = await fetch("/api/users/me/avatar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = (await response.json()) as {
    data: { avatarUrl: string } | null;
    error: { message: string } | null;
  };

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "保存头像失败");
  }

  return payload.data;
}

export function AvatarUpload({ userId, name, email, avatarUrl }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { mutate } = useSWRConfig();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const initials = useMemo(() => getInitials(name, email), [email, name]);

  async function handleFile(file: File) {
    try {
      assertAvatarFile(file);
      const localPreviewUrl = URL.createObjectURL(file);
      setPreviewUrl(localPreviewUrl);
      setProgress(0);
      setIsUploading(true);

      const presigned = await requestPresignedUpload(file);
      await uploadFileToR2(file, presigned.uploadUrl, setProgress);
      await confirmAvatarUpload({
        key: presigned.key,
        contentType: file.type,
        sizeBytes: file.size,
      });
      await mutate("/api/users/me");

      toast.success("头像已更新");
      setProgress(100);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "头像上传失败");
      setPreviewUrl(null);
      setProgress(0);
    } finally {
      setIsUploading(false);
    }
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file) {
      void handleFile(file);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];

    if (file) {
      void handleFile(file);
    }
  }

  return (
    <div
      className="flex flex-col gap-4 rounded-lg border border-dashed p-4"
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-4">
        <Avatar className="size-20">
          {previewUrl ? (
            <AvatarImage src={previewUrl} alt={`${name ?? email} 的头像预览`} />
          ) : avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={`${name ?? email} 的头像`}
              fill
              sizes="80px"
              className="rounded-full object-cover"
              unoptimized
            />
          ) : (
            <AvatarImage src={avatarUrl ?? undefined} alt={`${name ?? email} 的头像`} />
          )}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>

        <div className="flex flex-1 flex-col gap-2">
          <div>
            <p className="text-sm font-medium">头像</p>
            <p className="text-sm text-muted-foreground">支持 jpeg、png、webp，最大 5MB。</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? (
                <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
              ) : (
                <CameraIcon data-icon="inline-start" />
              )}
              选择头像
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
            >
              <UploadCloudIcon data-icon="inline-start" />
              拖拽或点击上传
            </Button>
          </div>
        </div>
      </div>

      {isUploading || progress > 0 ? <Progress value={progress} /> : null}

      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        data-user-id={userId}
        onChange={onInputChange}
      />
    </div>
  );
}
