"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const RECORDING_MIME_TYPE = "audio/webm;codecs=opus";
const FALLBACK_MIME_TYPE = "audio/webm";
const MULTIPART_THRESHOLD_BYTES = 10 * 1024 * 1024;
const MULTIPART_PART_SIZE_BYTES = 8 * 1024 * 1024;
const LARGE_FILE_WARNING_BYTES = 500 * 1024 * 1024;

type ApiResponse<T> = {
  data: T | null;
  error: { message: string } | null;
};

type PresignedAudioResponse = {
  uploadUrl: string;
  key: string;
  fileName: string;
};

type MultipartStartResponse = {
  key: string;
  fileName: string;
  uploadId: string;
  parts: Array<{
    partNumber: number;
    uploadUrl: string;
  }>;
};

type ConfirmAudioResponse = {
  key: string;
  url: string;
  file: {
    id: string;
    url: string;
  };
};

type UploadedAudio = {
  key: string;
  url: string;
  fileId: string;
};

async function readApiResponse<T>(response: Response, fallbackMessage: string) {
  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? fallbackMessage);
  }

  return payload.data;
}

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return FALLBACK_MIME_TYPE;
  }

  if (MediaRecorder.isTypeSupported(RECORDING_MIME_TYPE)) {
    return RECORDING_MIME_TYPE;
  }

  if (MediaRecorder.isTypeSupported(FALLBACK_MIME_TYPE)) {
    return FALLBACK_MIME_TYPE;
  }

  return "";
}

async function putBlobWithProgress(
  blob: Blob,
  uploadUrl: string,
  contentType: string,
  onProgress: (progress: number) => void,
) {
  const body = await blob.arrayBuffer();

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

      reject(new Error("录音上传失败"));
    });

    xhr.addEventListener("error", () => {
      reject(new Error("录音上传失败"));
    });

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.send(body);
  });
}

async function putPartWithProgress(
  blob: Blob,
  uploadUrl: string,
  onProgress: (loadedBytes: number) => void,
) {
  const body = await blob.arrayBuffer();

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let previousLoaded = 0;

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded - previousLoaded);
        previousLoaded = event.loaded;
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");

        if (!etag) {
          reject(new Error("R2 未返回分片 ETag"));
          return;
        }

        resolve(etag);
        return;
      }

      reject(new Error("录音分片上传失败"));
    });

    xhr.addEventListener("error", () => {
      reject(new Error("录音分片上传失败"));
    });

    xhr.open("PUT", uploadUrl);
    xhr.send(body);
  });
}

export async function multipartUpload(
  meetingId: string,
  blob: Blob,
  onProgress: (progress: number) => void,
  timestamp = Date.now(),
) {
  const partCount = Math.ceil(blob.size / MULTIPART_PART_SIZE_BYTES);
  const startResponse = await fetch(
    `/api/meetings/${encodeURIComponent(meetingId)}/files/audio/multipart/start`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contentType: FALLBACK_MIME_TYPE,
        partCount,
        timestamp,
      }),
    },
  );
  const started = await readApiResponse<MultipartStartResponse>(
    startResponse,
    "创建分片上传失败",
  );
  let uploadedBytes = 0;

  try {
    const parts = [];

    for (const part of started.parts) {
      const start = (part.partNumber - 1) * MULTIPART_PART_SIZE_BYTES;
      const end = Math.min(start + MULTIPART_PART_SIZE_BYTES, blob.size);
      const chunk = blob.slice(start, end, FALLBACK_MIME_TYPE);
      const etag = await putPartWithProgress(chunk, part.uploadUrl, (delta) => {
        uploadedBytes += delta;
        onProgress(Math.min(99, Math.round((uploadedBytes / blob.size) * 100)));
      });

      parts.push({
        partNumber: part.partNumber,
        etag,
      });
    }

    const completeResponse = await fetch(
      `/api/meetings/${encodeURIComponent(meetingId)}/files/audio/multipart/complete`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: started.key,
          uploadId: started.uploadId,
          parts,
        }),
      },
    );
    await readApiResponse<{ completed: boolean }>(completeResponse, "完成分片上传失败");
    onProgress(100);

    return {
      key: started.key,
      fileName: started.fileName,
    };
  } catch (error) {
    await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/files/audio/multipart/abort`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: started.key,
        uploadId: started.uploadId,
      }),
    }).catch(() => undefined);
    throw error;
  }
}

async function directUpload(
  meetingId: string,
  blob: Blob,
  onProgress: (progress: number) => void,
  timestamp = Date.now(),
) {
  const presignedResponse = await fetch(
    `/api/meetings/${encodeURIComponent(meetingId)}/files/audio/presigned`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contentType: FALLBACK_MIME_TYPE,
        timestamp,
      }),
    },
  );
  const presigned = await readApiResponse<PresignedAudioResponse>(
    presignedResponse,
    "创建录音上传链接失败",
  );

  await putBlobWithProgress(blob, presigned.uploadUrl, FALLBACK_MIME_TYPE, onProgress);

  return {
    key: presigned.key,
    fileName: presigned.fileName,
  };
}

async function confirmAudioUpload(meetingId: string, key: string, fileName: string) {
  const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/files/audio`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      fileName,
    }),
  });
  const confirmed = await readApiResponse<ConfirmAudioResponse>(response, "确认录音上传失败");

  return {
    key: confirmed.key,
    url: confirmed.url,
    fileId: confirmed.file.id,
  };
}

export function useMediaRecorder(meetingId: string) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastBlobRef = useRef<Blob | null>(null);
  const stopResolverRef = useRef<((value: Blob | null) => void) | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [uploadedAudio, setUploadedAudio] = useState<UploadedAudio | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [estimatedSizeBytes, setEstimatedSizeBytes] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadBlob = useCallback(
    async (blob: Blob, timestamp = Date.now()) => {
      setIsUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        if (blob.size > LARGE_FILE_WARNING_BYTES) {
          setWarning("录音文件超过 500MB，上传可能需要较长时间");
        }

        const uploaded =
          blob.size > MULTIPART_THRESHOLD_BYTES
            ? await multipartUpload(meetingId, blob, setUploadProgress, timestamp)
            : await directUpload(meetingId, blob, setUploadProgress, timestamp);
        const confirmed = await confirmAudioUpload(meetingId, uploaded.key, uploaded.fileName);
        setUploadedAudio(confirmed);
        setUploadProgress(100);
        return confirmed;
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "录音上传失败";
        setError(message);
        throw new Error(message);
      } finally {
        setIsUploading(false);
      }
    },
    [meetingId],
  );

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    if (!meetingId || recorderRef.current?.state === "recording") {
      return;
    }

    const mimeType = getSupportedMimeType();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];
    startedAtRef.current = Date.now();
    setDurationMs(0);
    setEstimatedSizeBytes(0);
    setAudioBlob(null);
    setUploadedAudio(null);
    setWarning(null);
    setError(null);

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
        setEstimatedSizeBytes((size) => size + event.data.size);
      }
    });

    recorder.addEventListener("stop", () => {
      const blob =
        chunksRef.current.length > 0
          ? new Blob(chunksRef.current, { type: FALLBACK_MIME_TYPE })
          : null;
      chunksRef.current = [];
      recorderRef.current = null;
      setIsRecording(false);
      setIsPaused(false);
      stopTracks();

      if (blob) {
        lastBlobRef.current = blob;
        setAudioBlob(blob);
      }

      stopResolverRef.current?.(blob);
      stopResolverRef.current = null;
    });

    recorder.start(1000);
    setIsRecording(true);
    setIsPaused(false);
  }, [meetingId, stopTracks]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      const existingBlob = lastBlobRef.current;

      if (existingBlob && !uploadedAudio) {
        return uploadBlob(existingBlob);
      }

      return uploadedAudio;
    }

    const timestamp = Date.now();
    const blobPromise = new Promise<Blob | null>((resolve) => {
      stopResolverRef.current = resolve;
    });
    recorder.stop();
    const blob = await blobPromise;

    if (!blob) {
      return null;
    }

    return uploadBlob(blob, timestamp);
  }, [uploadBlob, uploadedAudio]);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;

    if (recorder?.state === "recording") {
      recorder.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;

    if (recorder?.state === "paused") {
      recorder.resume();
      setIsPaused(false);
    }
  }, []);

  const retry = useCallback(async () => {
    const blob = lastBlobRef.current;

    if (!blob) {
      throw new Error("没有可重试的录音文件");
    }

    return uploadBlob(blob);
  }, [uploadBlob]);

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const timer = window.setInterval(() => {
      if (startedAtRef.current) {
        setDurationMs(Date.now() - startedAtRef.current);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }

      stopTracks();
    };
  }, [stopTracks]);

  return {
    start,
    stop,
    pause,
    resume,
    retry,
    uploadProgress,
    isRecording,
    isPaused,
    isUploading,
    audioBlob,
    uploadedAudio,
    durationMs,
    estimatedSizeBytes,
    warning,
    error,
  };
}
