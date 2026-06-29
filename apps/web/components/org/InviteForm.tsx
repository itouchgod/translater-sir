"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircleIcon, SendIcon } from "lucide-react";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type InviteFormProps = {
  organizationId: string;
  canManage: boolean;
};

const roleOptions = [
  { value: "ADMIN", label: "管理员" },
  { value: "MEMBER", label: "成员" },
  { value: "VIEWER", label: "只读" },
] as const;

const InviteMemberClientSchema = z.object({
  email: z.email("请输入有效邮箱").trim().toLowerCase(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]),
});

type InviteMemberInput = z.infer<typeof InviteMemberClientSchema>;

export function InviteForm({ organizationId, canManage }: InviteFormProps) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<InviteMemberInput>({
    resolver: zodResolver(InviteMemberClientSchema),
    defaultValues: {
      email: "",
      role: "MEMBER",
    },
  });

  function onSubmit(values: InviteMemberInput) {
    startTransition(async () => {
      const response = await fetch(`/api/organizations/${organizationId}/members/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as {
        data: { invited: boolean } | null;
        error: { message: string } | null;
      };

      if (!response.ok || payload.error || !payload.data) {
        toast.error(payload.error?.message ?? "发送邀请失败");
        return;
      }

      toast.success("邀请邮件已发送");
      form.reset({
        email: "",
        role: "MEMBER",
      });
    });
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field data-invalid={Boolean(form.formState.errors.email)}>
          <FieldLabel htmlFor="invite-email">邮箱</FieldLabel>
          <Input
            id="invite-email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(form.formState.errors.email)}
            disabled={!canManage || isPending}
            {...form.register("email")}
          />
          <FieldError>{form.formState.errors.email?.message}</FieldError>
        </Field>

        <Field data-invalid={Boolean(form.formState.errors.role)}>
          <FieldLabel htmlFor="invite-role">角色</FieldLabel>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={!canManage || isPending}
              >
                <SelectTrigger id="invite-role" aria-invalid={Boolean(form.formState.errors.role)}>
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {roleOptions.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
          <FieldDescription>邀请链接 24 小时内有效。</FieldDescription>
          <FieldError>{form.formState.errors.role?.message}</FieldError>
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={!canManage || isPending}>
        {isPending ? (
          <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
        ) : (
          <SendIcon data-icon="inline-start" />
        )}
        发送邀请
      </Button>
    </form>
  );
}
