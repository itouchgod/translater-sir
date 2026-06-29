"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircleIcon } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateProfileAction } from "@/app/(dashboard)/settings/profile/actions";
import { UpdateProfileSchema, type UpdateProfileInput } from "@/lib/validations/user";

type ProfileFormProps = {
  name: string | null;
  email: string;
};

export function ProfileForm({ name, email }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(UpdateProfileSchema),
    defaultValues: {
      name: name ?? "",
    },
  });

  function onSubmit(values: UpdateProfileInput) {
    startTransition(async () => {
      const result = await updateProfileAction(values);

      if (!result.success) {
        toast.error(result.error ?? "更新资料失败");
        return;
      }

      toast.success("个人资料已更新");
    });
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="email">邮箱</FieldLabel>
          <Input id="email" value={email} readOnly disabled />
          <FieldDescription>邮箱用于登录和系统通知，当前不可在此处修改。</FieldDescription>
        </Field>

        <Field data-invalid={Boolean(form.formState.errors.name)}>
          <FieldLabel htmlFor="name">姓名</FieldLabel>
          <Input
            id="name"
            autoComplete="name"
            aria-invalid={Boolean(form.formState.errors.name)}
            disabled={isPending}
            {...form.register("name")}
          />
          <FieldError>{form.formState.errors.name?.message}</FieldError>
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={isPending || !form.formState.isDirty}>
        {isPending ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : null}
        保存资料
      </Button>
    </form>
  );
}
