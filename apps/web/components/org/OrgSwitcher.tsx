"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand/BrandMark";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { switchOrganizationAction } from "@/app/(dashboard)/settings/organization/actions";

type OrganizationOption = {
  id: string;
  name: string;
  slug: string;
};

type OrgSwitcherProps = {
  organizations: OrganizationOption[];
  activeOrganizationId: string | null;
};

export function OrgSwitcher({ organizations, activeOrganizationId }: OrgSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onValueChange(organizationId: string) {
    if (organizationId === activeOrganizationId) {
      return;
    }

    startTransition(async () => {
      const result = await switchOrganizationAction(organizationId);

      if (!result.success) {
        toast.error(result.error ?? "切换组织失败");
        return;
      }

      toast.success("已切换组织");
      router.refresh();
    });
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      {isPending ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : <BrandMark size={24} />}
      <Select
        value={activeOrganizationId ?? undefined}
        onValueChange={onValueChange}
        disabled={isPending || organizations.length === 0}
      >
        <SelectTrigger className="w-[220px] max-w-full">
          <SelectValue placeholder="选择组织" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {organizations.map((organization) => (
              <SelectItem key={organization.id} value={organization.id}>
                {organization.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
