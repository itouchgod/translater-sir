"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TtsQueueItem = {
  text: string;
  language: string;
  speed: number;
};

export type UseTtsPlayerReturn = {
  play: (text: string, language: string, speed?: number) => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  isMuted: boolean;
  toggleMute: () => void;
  isPlaying: boolean;
  volume: number;
  currentText: string | null;
  error: string | null;
};

function clampVolume(value: number) {
  if (Number.isNaN(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0, value));
}

async function fetchTtsAudio(item: TtsQueueItem) {
  const response = await fetch("/api/tts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: item.text,
      language: item.language,
      speed: item.speed,
    }),
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as {
        error?: { message?: string };
      };
      throw new Error(payload.error?.message ?? "语音合成失败，请稍后重试");
    }

    throw new Error("语音合成失败，请稍后重试");
  }

  return response.arrayBuffer();
}

export function useTtsPlayer(): UseTtsPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const queueRef = useRef<TtsQueueItem[]>([]);
  const processingRef = useRef(false);
  const disposedRef = useRef(false);
  const stopVersionRef = useRef(0);
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);

  const applyGain = useCallback(() => {
    const gainNode = gainNodeRef.current;

    if (!gainNode) {
      return;
    }

    gainNode.gain.value = isMutedRef.current ? 0 : volumeRef.current;
  }, []);

  const ensureAudioGraph = useCallback(() => {
    const existingContext = audioContextRef.current;

    if (existingContext) {
      return existingContext;
    }

    const audioContext = new AudioContext();
    const gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
    audioContextRef.current = audioContext;
    gainNodeRef.current = gainNode;
    applyGain();

    return audioContext;
  }, [applyGain]);

  const processQueue = useCallback(async () => {
    if (processingRef.current || disposedRef.current) {
      return;
    }

    const item = queueRef.current.shift();

    if (!item) {
      setIsPlaying(false);
      setCurrentText(null);
      return;
    }

    processingRef.current = true;
    const stopVersion = stopVersionRef.current;
    setIsPlaying(true);
    setCurrentText(item.text);
    setError(null);

    try {
      const audioContext = ensureAudioGraph();

      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      const audioData = await fetchTtsAudio(item);
      const audioBuffer = await audioContext.decodeAudioData(audioData.slice(0));

      if (disposedRef.current || stopVersion !== stopVersionRef.current) {
        processingRef.current = false;
        return;
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(gainNodeRef.current ?? audioContext.destination);
      sourceRef.current = source;
      source.onended = () => {
        source.disconnect();
        sourceRef.current = null;
        processingRef.current = false;
        void processQueue();
      };
      source.start();
    } catch (playError) {
      processingRef.current = false;
      setError(playError instanceof Error ? playError.message : "语音播放失败，请稍后重试");
      void processQueue();
    }
  }, [ensureAudioGraph]);

  const play = useCallback(
    (text: string, language: string, speed = 1) => {
      const trimmed = text.trim();

      if (!trimmed || disposedRef.current) {
        return;
      }

      queueRef.current.push({
        text: trimmed,
        language,
        speed,
      });
      void processQueue();
    },
    [processQueue],
  );

  const stop = useCallback(() => {
    queueRef.current = [];
    processingRef.current = false;
    stopVersionRef.current += 1;
    const source = sourceRef.current;

    if (source) {
      source.onended = null;
      source.stop();
      source.disconnect();
      sourceRef.current = null;
    }

    setIsPlaying(false);
    setCurrentText(null);
  }, []);

  const setVolume = useCallback(
    (nextVolume: number) => {
      const clamped = clampVolume(nextVolume);
      volumeRef.current = clamped;
      setVolumeState(clamped);
      applyGain();
    },
    [applyGain],
  );

  const toggleMute = useCallback(() => {
    setIsMuted((previous) => {
      const next = !previous;
      isMutedRef.current = next;
      applyGain();
      return next;
    });
  }, [applyGain]);

  useEffect(() => {
    volumeRef.current = volume;
    isMutedRef.current = isMuted;
    applyGain();
  }, [applyGain, isMuted, volume]);

  useEffect(() => {
    return () => {
      disposedRef.current = true;
      stop();
      void audioContextRef.current?.close();
      audioContextRef.current = null;
      gainNodeRef.current = null;
    };
  }, [stop]);

  return {
    play,
    stop,
    setVolume,
    isMuted,
    toggleMute,
    isPlaying,
    volume,
    currentText,
    error,
  };
}
