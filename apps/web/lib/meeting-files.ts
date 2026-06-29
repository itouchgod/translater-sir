import { FileType } from "@prisma/client";
import { requireOrgMember } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { getR2Key } from "@/lib/r2";

export async function requireMeetingFileAccess(meetingId: string) {
  const meeting = await db.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      organizationId: true,
      audioUrl: true,
    },
  });

  if (!meeting) {
    throw new NotFoundError("会议不存在");
  }

  await requireOrgMember(meeting.organizationId);
  return meeting;
}

export async function requireFileInMeeting(meetingId: string, fileId: string) {
  const file = await db.meetingFile.findFirst({
    where: {
      id: fileId,
      meetingId,
    },
    include: {
      meeting: {
        select: {
          id: true,
          organizationId: true,
        },
      },
    },
  });

  if (!file) {
    throw new NotFoundError("文件不存在");
  }

  await requireOrgMember(file.meeting.organizationId);
  return file;
}

export function buildRecordingFileName(timestamp = Date.now()) {
  return `recording-${timestamp}.webm`;
}

export function buildRecordingKey(orgId: string, meetingId: string, fileName = buildRecordingFileName()) {
  return getR2Key("meetingAudio", orgId, meetingId, fileName);
}

export function assertMeetingAudioKey(params: { key: string; orgId: string; meetingId: string }) {
  const prefix = getR2Key("meetingAudio", params.orgId, params.meetingId);

  if (!params.key.startsWith(`${prefix}/`)) {
    throw new ForbiddenError("录音文件 Key 无效");
  }
}

export function assertAudioContentType(contentType: string) {
  if (contentType !== "audio/webm") {
    throw new ValidationError("录音文件类型必须为 audio/webm");
  }
}

export function getMeetingFileName(key: string, fallback = "recording.webm") {
  return key.split("/").filter(Boolean).at(-1) ?? fallback;
}

export function isAudioFile(type: FileType) {
  return type === FileType.AUDIO;
}
