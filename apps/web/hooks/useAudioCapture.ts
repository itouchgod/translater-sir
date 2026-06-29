"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseAudioCaptureState = {
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  audioLevel: number;
  isCapturing: boolean;
  isPaused: boolean;
  error: string | null;
};

const AUDIO_CHUNK_INTERVAL_MS = 250;
const SILENCE_LEVEL = 5;
const SILENCE_TIMEOUT_MS = 3000;
const PREFERRED_MIME_TYPE = "audio/webm;codecs=opus";

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  if (MediaRecorder.isTypeSupported(PREFERRED_MIME_TYPE)) {
    return PREFERRED_MIME_TYPE;
  }

  if (MediaRecorder.isTypeSupported("audio/webm")) {
    return "audio/webm";
  }

  return "";
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => {
      reject(new Error("音频编码失败"));
    };
    reader.readAsDataURL(blob);
  });
}

export function useAudioCapture(meetingId: string): UseAudioCaptureState {
  const [audioLevel, setAudioLevel] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastAudibleAtRef = useRef(0);
  const silentRef = useRef(false);
  const pausedRef = useRef(false);
  const stoppedRef = useRef(true);

  const cleanupAudioGraph = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });
    streamRef.current = null;

    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
  }, []);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    pausedRef.current = false;

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    mediaRecorderRef.current = null;
    cleanupAudioGraph();
    setIsCapturing(false);
    setIsPaused(false);
    setAudioLevel(0);
  }, [cleanupAudioGraph]);

  const sendChunk = useCallback(
    async (blob: Blob) => {
      if (stoppedRef.current || pausedRef.current || silentRef.current || blob.size === 0) {
        return;
      }

      const chunk = await blobToBase64(blob);

      if (!chunk) {
        return;
      }

      const response = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/asr/chunk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chunk,
          chunkId: crypto.randomUUID(),
          mimeType: blob.type || PREFERRED_MIME_TYPE,
          timestamp: Date.now(),
        }),
      });

      const payload = (await response.json()) as {
        error: { message: string } | null;
      };

      if (!response.ok || payload.error) {
        throw new Error(payload.error?.message ?? "音频发送失败，请检查网络后重试");
      }
    },
    [meetingId],
  );

  const startAnalyser = useCallback((stream: MediaStream) => {
    const AudioContextClass = window.AudioContext;
    const audioContext = new AudioContextClass({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    const samples = new Uint8Array(analyser.fftSize);

    analyser.fftSize = 1024;
    source.connect(analyser);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    lastAudibleAtRef.current = Date.now();
    silentRef.current = false;

    const updateLevel = () => {
      analyser.getByteTimeDomainData(samples);

      let sum = 0;
      for (const sample of samples) {
        const centered = sample - 128;
        sum += centered * centered;
      }

      const rms = Math.sqrt(sum / samples.length);
      const nextLevel = Math.min(100, Math.round((rms / 64) * 100));

      if (nextLevel >= SILENCE_LEVEL) {
        lastAudibleAtRef.current = Date.now();
        silentRef.current = false;
      } else if (Date.now() - lastAudibleAtRef.current >= SILENCE_TIMEOUT_MS) {
        silentRef.current = true;
      }

      setAudioLevel(nextLevel);
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }, []);

  const start = useCallback(async () => {
    if (!meetingId || mediaRecorderRef.current?.state === "recording") {
      return;
    }

    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      stoppedRef.current = false;
      pausedRef.current = false;

      recorder.addEventListener("dataavailable", (event) => {
        void sendChunk(event.data).catch((sendError: unknown) => {
          setError(sendError instanceof Error ? sendError.message : "音频发送失败，请检查网络后重试");
        });
      });
      recorder.addEventListener("error", () => {
        setError("麦克风录制出现问题，请重新开始录音");
      });
      recorder.addEventListener("stop", () => {
        setIsCapturing(false);
      });

      startAnalyser(stream);
      recorder.start(AUDIO_CHUNK_INTERVAL_MS);
      setIsCapturing(true);
      setIsPaused(false);
    } catch (captureError) {
      cleanupAudioGraph();
      setIsCapturing(false);
      setIsPaused(false);
      setError(
        captureError instanceof DOMException && captureError.name === "NotAllowedError"
          ? "无法访问麦克风，请在浏览器设置中允许麦克风权限"
          : "无法启动麦克风，请检查设备后重试",
      );
    }
  }, [cleanupAudioGraph, meetingId, sendChunk, startAnalyser]);

  const pause = useCallback(() => {
    pausedRef.current = true;
    const recorder = mediaRecorderRef.current;

    if (recorder?.state === "recording") {
      recorder.pause();
    }

    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    pausedRef.current = false;
    lastAudibleAtRef.current = Date.now();
    silentRef.current = false;
    const recorder = mediaRecorderRef.current;

    if (recorder?.state === "paused") {
      recorder.resume();
    }

    setIsPaused(false);
  }, []);

  useEffect(() => stop, [stop]);

  return {
    start,
    stop,
    pause,
    resume,
    audioLevel,
    isCapturing,
    isPaused,
    error,
  };
}
