import { createDeepgramStream } from "@/lib/asr/deepgram";
import type { AsrConfig, AsrProvider, AsrStream } from "@/lib/asr/types";

export type { AsrConfig, AsrProvider, AsrStream, TranscriptResult } from "@/lib/asr/types";

export function createAsrStream(config: AsrConfig): AsrStream {
  if (config.provider === "deepgram") {
    return createDeepgramStream(config);
  }

  throw new Error(`ASR provider is not implemented: ${config.provider satisfies AsrProvider}`);
}
