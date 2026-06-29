import { notFound } from "next/navigation";
import { MeetingDetailClient } from "@/components/meeting/MeetingDetailClient";
import { requireOrgMember } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import type { MeetingDetail } from "@/hooks/useMeeting";

type MeetingDetailPageProps = {
  params: Promise<{ id: string }>;
};

function serializeMeeting(meeting: NonNullable<Awaited<ReturnType<typeof loadMeeting>>>): MeetingDetail {
  return {
    ...meeting,
    startedAt: meeting.startedAt?.toISOString() ?? null,
    endedAt: meeting.endedAt?.toISOString() ?? null,
    createdAt: meeting.createdAt.toISOString(),
    updatedAt: meeting.updatedAt.toISOString(),
    files: meeting.files.map((file) => ({
      ...file,
      createdAt: file.createdAt.toISOString(),
    })),
  };
}

async function loadMeeting(id: string) {
  return db.meeting.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
      files: {
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          segments: true,
          files: true,
        },
      },
    },
  });
}

export default async function MeetingDetailPage({ params }: MeetingDetailPageProps) {
  const { id } = await params;
  const meeting = await loadMeeting(id);

  if (!meeting) {
    notFound();
  }

  await requireOrgMember(meeting.organizationId);

  return <MeetingDetailClient meetingId={meeting.id} initialMeeting={serializeMeeting(meeting)} />;
}
