import { withApiHandler } from "@/lib/api-handler";
import { requireOrgMember } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { redis } from "@/lib/redis";
import { RedisKeys } from "@/utils/redis-keys";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const encoder = new TextEncoder();

export const runtime = "nodejs";

function encodeSse(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export const GET = withApiHandler(async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const meeting = await db.meeting.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!meeting) {
    throw new NotFoundError("会议不存在");
  }

  await requireOrgMember(meeting.organizationId);

  let cursor = 0;
  let interval: ReturnType<typeof setInterval> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encodeSse("connected", { meetingId: meeting.id }));

      interval = setInterval(() => {
        void (async () => {
          const key = RedisKeys.meetingSubtitle(meeting.id);
          const entries = await redis.lrange(key, cursor, -1);

          if (entries.length === 0) {
            controller.enqueue(encodeSse("ping", { timestamp: Date.now() }));
            return;
          }

          cursor += entries.length;

          for (const entry of entries) {
            controller.enqueue(encodeSse("message", JSON.parse(entry)));
          }
        })().catch((error: unknown) => {
          controller.error(error);
          if (interval) {
            clearInterval(interval);
          }
        });
      }, 200);
    },
    cancel() {
      if (interval) {
        clearInterval(interval);
      }

      return undefined;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
