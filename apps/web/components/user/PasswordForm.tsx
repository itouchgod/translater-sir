"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircleIcon } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { UpdatePasswordSchema, type UpdatePasswordInput } from "@/lib/validations/user";

async function updatePassword(values: UpdatePasswordInput) {
  const response = await fetch("/api/users/me/password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(values),
  });
  const payload = (await response.json()) as {
    data: { updated: boolean } | null;
    error: { message: string } | null;
  };

  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? "修改密码失败");
  }

  return payload.data;
}

export function PasswordForm() {
  const [isPending, startTransition] = useTransition();
  const form = useForm<UpdatePasswordInput>({
    resolver: zodResolver(UpdatePasswordSchema),
    defaultValues: {
      currentPassword: "",
      password: "",
      confirmPassword: "",
    },
  });

  function onSubmit(values: UpdatePasswordInput) {
    startTransition(async () => {
      try {
        await updatePassword(values);
        toast.success("密码已更新");
        form.reset();
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "修改密码失败");
      }
    });
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field data-invalid={Boolean(form.formState.errors.currentPassword)}>
          <FieldLabel htmlFor="currentPassword">当前密码</FieldLabel>
          <Input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(form.formState.errors.currentPassword)}
            disabled={isPending}
            {...form.register("currentPassword")}
          />
          <FieldError>{form.formState.errors.currentPassword?.message}</FieldError>
        </Field>

        <Field data-invalid={Boolean(form.formState.errors.password)}>
          <FieldLabel htmlFor="password">新密码</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.password)}
            disabled={isPending}
            {...form.register("password")}
          />
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </Field>

        <Field data-invalid={Boolean(form.formState.errors.confirmPassword)}>
          <FieldLabel htmlFor="confirmPassword">确认新密码</FieldLabel>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(form.formState.errors.confirmPassword)}
            disabled={isPending}
            {...form.register("confirmPassword")}
          />
          <FieldError>{form.formState.errors.confirmPassword?.message}</FieldError>
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={isPending}>
        {isPending ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : null}
        修改密码
      </Button>
    </form>
  );
}
