export type {
  Account,
  AiLog,
  ApiKey,
  AuditLog,
  Dictionary,
  DictionaryTerm,
  DownloadLog,
  Meeting,
  MeetingFile,
  MeetingSegment,
  Member,
  Organization,
  Session,
  Subscription,
  User,
  VerificationToken,
  Webhook,
} from "@prisma/client";

export {
  AiType,
  FileType,
  MeetingStatus,
  MemberRole,
  Plan,
  Prisma,
  SubscriptionStatus,
  UserRole,
} from "@prisma/client";

import type { Prisma } from "@prisma/client";

export type UserWithMemberships = Prisma.UserGetPayload<{
  include: {
    memberships: {
      include: {
        organization: true;
      };
    };
  };
}>;

export type OrganizationWithMembers = Prisma.OrganizationGetPayload<{
  include: {
    members: {
      include: {
        user: true;
      };
    };
  };
}>;

export type MeetingWithDetails = Prisma.MeetingGetPayload<{
  include: {
    organization: true;
    createdBy: true;
    segments: true;
    files: true;
    aiLogs: true;
  };
}>;

export type DictionaryWithTerms = Prisma.DictionaryGetPayload<{
  include: {
    terms: true;
  };
}>;

export type UserSafeSelect = {
  id: true;
  email: true;
  emailVerified: true;
  name: true;
  avatarUrl: true;
  role: true;
  createdAt: true;
  updatedAt: true;
};

export const userSafeSelect = {
  id: true,
  email: true,
  emailVerified: true,
  name: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const meetingListSelect = {
  id: true,
  organizationId: true,
  createdById: true,
  title: true,
  status: true,
  sourceLanguage: true,
  targetLanguage: true,
  startedAt: true,
  endedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MeetingSelect;
