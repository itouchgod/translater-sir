import { DeepgramClient, type Deepgram } from "@deepgram/sdk";
import { logger } from "@/lib/logger";
import type { AsrConfig, AsrStream, TranscriptResult } from "@/lib/asr/types";

type DeepgramSocket = Awaited<ReturnType<DeepgramClient["listen"]["v1"]["connect"]>>;
type DeepgramMessage =
  | Deepgram.listen.ListenV1Results
  | Deepgram.listen.ListenV1Metadata
  | Deepgram.listen.ListenV1UtteranceEnd
  | Deepgram.listen.ListenV1SpeechStarted;

const DEFAULT_DEEPGRAM_MODEL = "nova-3";
const DEFAULT_MAX_RECONNECTS = 3;
const RECONNECT_DELAY_MS = 500;

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toTranscriptResult(
  message: Deepgram.listen.ListenV1Results,
  config: AsrConfig,
): TranscriptResult | null {
  const alternative = message.channel.alternatives[0];
  const text = alternative?.transcript?.trim();

  if (!text) {
    return null;
  }

  const language = alternative.languages?.[0] ?? config.language;
  const startMs = Math.max(0, Math.round(message.start * 1000));
  const endMs = Math.max(startMs, Math.round((message.start + message.duration) * 1000));

  return {
    text,
    isFinal: Boolean(message.is_final),
    language,
    confidence: alternative.confidence,
    startMs,
    endMs,
    provider: "deepgram",
    model: message.metadata.model_info.name || config.model || DEFAULT_DEEPGRAM_MODEL,
    requestId: message.metadata.request_id,
    receivedAt: Date.now(),
  };
}

export function createDeepgramStream(config: AsrConfig): AsrStream {
  const apiKey = process.env.DEEPGRAM_API_KEY;

  if (!apiKey) {
    throw new Error("DEEPGRAM_API_KEY is not configured");
  }

  const maxReconnects = config.maxReconnects ?? DEFAULT_MAX_RECONNECTS;
  const client = new DeepgramClient({ apiKey });
  let socketPromise: Promise<DeepgramSocket> | null = null;
  let socket: DeepgramSocket | null = null;
  let reconnects = 0;
  let closed = false;
  let reconnecting: Promise<void> | null = null;

  async function emitError(error: Error) {
    logger.error({ error }, "Deepgram stream error");
    await Promise.resolve(config.onError?.(error)).catch((callbackError: unknown) => {
      logger.error({ error: callbackError }, "Deepgram onError callback failed");
    });
  }

  function handleMessage(message: DeepgramMessage) {
    if (message.type !== "Results") {
      return;
    }

    const transcript = toTranscriptResult(message, config);

    if (!transcript) {
      return;
    }

    void Promise.resolve(config.onTranscript(transcript)).catch((error: unknown) => {
      logger.error({ error }, "ASR transcript callback failed");
    });
  }

  async function connect() {
    if (closed) {
      throw new Error("Deepgram stream is closed");
    }

    const nextSocket = await client.listen.v1.connect({
      model: (config.model ?? DEFAULT_DEEPGRAM_MODEL) as Deepgram.ListenV1Model,
      language: config.language as Deepgram.ListenV1Language,
      sample_rate: config.sampleRate,
      punctuate: "true",
      smart_format: "true",
      interim_results: "true",
      encoding: undefined,
      reconnectAttempts: 0,
      connectionTimeoutInSeconds: 10,
    });

    nextSocket.on("open", () => {
      reconnects = 0;
    });
    nextSocket.on("message", handleMessage);
    nextSocket.on("error", (error) => {
      void emitError(error);
      void reconnect();
    });
    nextSocket.on("close", () => {
      if (!closed) {
        void reconnect();
      }
    });

    socket = nextSocket;
    await nextSocket.waitForOpen();
    return nextSocket;
  }

  async function getSocket() {
    socketPromise ??= connect().catch((error: unknown) => {
      socketPromise = null;
      throw error;
    });

    return socketPromise;
  }

  async function reconnect() {
    if (closed || reconnecting) {
      return;
    }

    reconnecting = (async () => {
      if (reconnects >= maxReconnects) {
        await emitError(new Error("Deepgram stream reconnect limit reached"));
        return;
      }

      reconnects += 1;
      socketPromise = null;

      try {
        socket?.close();
      } catch (error) {
        logger.debug({ error }, "Deepgram socket close during reconnect failed");
      }

      await delay(RECONNECT_DELAY_MS * reconnects);
      await getSocket();
    })().finally(() => {
      reconnecting = null;
    });

    await reconnecting;
  }

  return {
    async sendAudio(chunk: Buffer) {
      const activeSocket = await getSocket();
      activeSocket.sendMedia(chunk);
    },
    close() {
      closed = true;
      socketPromise = null;
      socket?.close();
      socket = null;
    },
  };
}
