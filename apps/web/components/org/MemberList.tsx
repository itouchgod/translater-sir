"use client";

import {
  LoaderCircleIcon,
  MoreHorizontalIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserCogIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type MemberRoleValue = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export type OrganizationMember = {
  id: string;
  role: MemberRoleValue;
  joinedAt: string | Date;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
};

export type MembersPageInfo = {
  nextCursor: string | null;
  hasMore: boolean;
};

type MemberListProps = {
  organizationId: string;
  currentUserId: string;
  canManage: boolean;
  initialMembers: OrganizationMember[];
  initialPageInfo: MembersPageInfo;
};

const roleLabels: Record<MemberRoleValue, string> = {
  OWNER: "所有者",
  ADMIN: "管理员",
  MEMBER: "成员",
  VIEWER: "只读",
};

const editableRoles = [
  { value: "ADMIN", label: "设为管理员" },
  { value: "MEMBER", label: "设为成员" },
  { value: "VIEWER", label: "设为只读" },
] as const;

function getInitials(member: OrganizationMember) {
  const source = member.user.name?.trim() || member.user.email;
  return source.slice(0, 2).toUpperCase();
}

async function readApiResponse<TData>(response: Response) {
  const payload = (await response.json()) as {
    data: TData | null;
    error: { message: string } | null;
  };

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "请求失败");
  }

  return payload.data;
}

export function MemberList({
  organizationId,
  currentUserId,
  canManage,
  initialMembers,
  initialPageInfo,
}: MemberListProps) {
  const [members, setMembers] = useState(initialMembers);
  const [pageInfo, setPageInfo] = useState(initialPageInfo);
  const [isPending, startTransition] = useTransition();

  function loadMore() {
    if (!pageInfo.nextCursor) {
      return;
    }

    startTransition(async () => {
      try {
        const data = await readApiResponse<{
          members: OrganizationMember[];
          pageInfo: MembersPageInfo;
        }>(
          await fetch(
            `/api/organizations/${organizationId}/members?cursor=${encodeURIComponent(
              pageInfo.nextCursor ?? "",
            )}&limit=20`,
          ),
        );

        setMembers((current) => [...current, ...data.members]);
        setPageInfo(data.pageInfo);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "加载成员失败");
      }
    });
  }

  function updateRole(memberId: string, role: "ADMIN" | "MEMBER" | "VIEWER") {
    startTransition(async () => {
      try {
        const member = await readApiResponse<OrganizationMember>(
          await fetch(`/api/organizations/${organizationId}/members/${memberId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ role }),
          }),
        );

        setMembers((current) =>
          current.map((currentMember) =>
            currentMember.id === member.id ? { ...currentMember, role: member.role } : currentMember,
          ),
        );
        toast.success("成员角色已更新");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "修改成员角色失败");
      }
    });
  }

  function removeMember(memberId: string) {
    startTransition(async () => {
      try {
        await readApiResponse<{ removed: boolean }>(
          await fetch(`/api/organizations/${organizationId}/members/${memberId}`, {
            method: "DELETE",
          }),
        );

        setMembers((current) => current.filter((member) => member.id !== memberId));
        toast.success("成员已移除");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "移除成员失败");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>成员</TableHead>
              <TableHead>角色</TableHead>
              <TableHead>加入时间</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">操作</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => {
              const isSelf = member.user.id === currentUserId;
              const isOwner = member.role === "OWNER";
              const actionDisabled = !canManage || isSelf || isOwner || isPending;

              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarImage src={member.user.avatarUrl ?? undefined} alt={member.user.email} />
                        <AvatarFallback>{getInitials(member)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {member.user.name ?? member.user.email}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={isOwner ? "default" : "secondary"}>
                      {roleLabels[member.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(member.joinedAt).toLocaleDateString("zh-CN")}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={actionDisabled}>
                          <MoreHorizontalIcon />
                          <span className="sr-only">打开成员操作</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>成员操作</DropdownMenuLabel>
                        <DropdownMenuGroup>
                          {editableRoles.map((role) => (
                            <DropdownMenuItem
                              key={role.value}
                              disabled={member.role === role.value}
                              onSelect={() => updateRole(member.id, role.value)}
                            >
                              {role.value === "ADMIN" ? (
                                <ShieldCheckIcon data-icon="inline-start" />
                              ) : (
                                <UserCogIcon data-icon="inline-start" />
                              )}
                              {role.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => removeMember(member.id)}
                          >
                            <Trash2Icon data-icon="inline-start" />
                            移除成员
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {pageInfo.hasMore ? (
        <Button type="button" variant="outline" onClick={loadMore} disabled={isPending}>
          {isPending ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : null}
          加载更多
        </Button>
      ) : null}
    </div>
  );
}
