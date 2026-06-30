"use client";

import {
  BookOpen,
  Building2,
  CalendarDays,
  CreditCard,
  Gauge,
  History,
  KeyRound,
  LogOut,
  Settings,
  ShieldCheck,
  User,
  Users,
  Webhook,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { logoutAction } from "@/app/(auth)/logout/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

type DashboardNavProps = {
  canViewBilling: boolean;
  canManageApiKeys: boolean;
  canManageWebhooks: boolean;
  canAccessAdmin: boolean;
  user: {
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
};

const primaryItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/meetings", label: "会议", icon: CalendarDays },
  { href: "/history", label: "历史", icon: History },
  { href: "/dictionary", label: "词典", icon: BookOpen },
];

function getInitials(name: string | null, email: string) {
  const source = name?.trim() || email;
  return source.slice(0, 1).toUpperCase();
}

export function DashboardNav({
  canViewBilling,
  canManageApiKeys,
  canManageWebhooks,
  canAccessAdmin,
  user,
}: DashboardNavProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const initials = getInitials(user.name, user.email);

  function logout() {
    startTransition(() => {
      void logoutAction().then((result) => {
        if (!result.success) {
          toast.error(result.error ?? "退出登录失败");
          return;
        }

        router.replace("/login");
        router.refresh();
      });
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <nav className="flex flex-wrap items-center gap-1.5" aria-label="主导航">
        {primaryItems.map((item) => (
          <Button key={item.href} asChild variant="ghost" size="sm">
            <Link href={item.href}>
              <item.icon />
              {item.label}
            </Link>
          </Button>
        ))}
        {canViewBilling ? (
          <Button asChild variant="ghost" size="sm">
            <Link href="/billing">
              <CreditCard />
              计费
            </Link>
          </Button>
        ) : null}
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="打开设置菜单">
            <Settings />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>设置</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/settings/profile">
                <User />
                个人资料
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/organization">
                <Building2 />
                组织
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/members">
                <Users />
                成员
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/security">
                <ShieldCheck />
                安全
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {(canManageApiKeys || canManageWebhooks || canAccessAdmin) ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                {canManageApiKeys ? (
                  <DropdownMenuItem asChild>
                    <Link href="/settings/api-keys">
                      <KeyRound />
                      API Key
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                {canManageWebhooks ? (
                  <DropdownMenuItem asChild>
                    <Link href="/settings/webhooks">
                      <Webhook />
                      Webhooks
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                {canAccessAdmin ? (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <ShieldCheck />
                      平台管理
                    </Link>
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="打开账号菜单">
            <Avatar size="sm">
              <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name ?? user.email} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="space-y-1">
            <span className="block truncate">{user.name ?? "当前账号"}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={isPending}
            onSelect={(event) => {
              event.preventDefault();
              logout();
            }}
          >
            <LogOut />
            {isPending ? "退出中" : "退出登录"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
