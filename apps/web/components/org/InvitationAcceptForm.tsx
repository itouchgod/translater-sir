"use client";

import { LoaderCircleIcon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { switchOrganizationAction } from "@/app/(dashboard)/settings/organization/actions";
import { Button } from "@/components/ui/button";

type InvitationAcceptFormProps = {
  token: string;
};

export function InvitationAcceptForm({ token }: InvitationAcceptFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function acceptInvitation() {
    startTransition(async () => {
      const response = await fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        data: { accepted: boolean; member: { organizationId: string } } | null;
        error: { message: string } | null;
      };

      if (!response.ok || payload.error || !payload.data) {
        toast.error(payload.error?.message ?? "接受邀请失败");
        return;
      }

      await switchOrganizationAction(payload.data.member.organizationId);
      toast.success("已加入组织");
      router.push("/settings/members");
      router.refresh();
    });
  }

  return (
    <Button type="button" onClick={acceptInvitation} disabled={isPending}>
      {isPending ? (
        <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
      ) : (
        <UserPlusIcon data-icon="inline-start" />
      )}
      接受邀请
    </Button>
  );
}
