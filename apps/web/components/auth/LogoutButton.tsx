"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { logoutAction } from "@/app/(auth)/logout/actions";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={isPending}
      onClick={() => {
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
      }}
    >
      <LogOut />
      {isPending ? "退出中" : "退出登录"}
    </Button>
  );
}
