import { Rest, type TokenRequest } from "ably";
import type { WsMessage, WsMessageHandler } from "@/types/websocket";

const globalForAbly = globalThis as unknown as {
  ablyRest?: Rest;
};

export function getMeetingChannelName(meetingId: string) {
  return `meeting:${meetingId}`;
}

export function getAblyServer() {
  if (!process.env.ABLY_API_KEY) {
    throw new Error("ABLY_API_KEY is not configured");
  }

  if (!globalForAbly.ablyRest) {
    globalForAbly.ablyRest = new Rest({ key: process.env.ABLY_API_KEY });
  }

  return globalForAbly.ablyRest;
}

export async function createMeetingSubscribeTokenRequest(params: {
  meetingId: string;
  clientId: string;
}): Promise<TokenRequest> {
  const channelName = getMeetingChannelName(params.meetingId);
  const capability = JSON.stringify({
    [channelName]: ["subscribe"],
  });

  return getAblyServer().auth.createTokenRequest({
    clientId: params.clientId,
    capability,
    ttl: 60 * 60 * 1000,
  });
}

export async function publishToMeeting(
  meetingId: string,
  event: WsMessage["type"],
  data: unknown = null,
) {
  const channel = getAblyServer().channels.get(getMeetingChannelName(meetingId));
  const message = data === null ? { type: event } : { type: event, data };

  await channel.publish(event, message);
}

export function dispatchWsMessage(message: WsMessage, handler: WsMessageHandler) {
  handler(message);
}
