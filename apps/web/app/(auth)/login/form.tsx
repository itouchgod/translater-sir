"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircleIcon, LoaderCircleIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoginSchema, type LoginInput } from "@/lib/validations/auth";
import { googleSignInAction, loginAction } from "./actions";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(values: LoginInput) {
    setError(null);
    startTransition(async () => {
      const result = await loginAction(values);

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.push(result.redirectTo ?? "/dashboard");
      router.refresh();
    });
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={form.handleSubmit(onSubmit)}>
      {error ? (
        <Alert variant="destructive">
          <AlertCircleIcon data-icon="inline-start" />
          <AlertTitle>登录失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field data-invalid={Boolean(form.formState.errors.email)}>
          <FieldLabel htmlFor="email">邮箱</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="name@example.com"
            aria-invalid={Boolean(form.formState.errors.email)}
            disabled={isPending}
            {...form.register("email")}
          />
          <FieldError>{form.formState.errors.email?.message}</FieldError>
        </Field>

        <Field data-invalid={Boolean(form.formState.errors.password)}>
          <div className="flex items-center justify-between gap-3">
            <FieldLabel htmlFor="password">密码</FieldLabel>
            <Link className="text-sm text-muted-foreground hover:text-foreground" href="/forgot-password">
              忘记密码
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={Boolean(form.formState.errors.password)}
            disabled={isPending}
            {...form.register("password")}
          />
          <FieldError>{form.formState.errors.password?.message}</FieldError>
        </Field>
      </FieldGroup>

      <Button type="submit" disabled={isPending}>
        {isPending ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : null}
        登录
      </Button>

      <FieldSeparator>或</FieldSeparator>

      <Button
        type="button"
        variant="outline"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await googleSignInAction();
          });
        }}
      >
        使用 Google 登录
      </Button>

      <FieldDescription className="text-center">
        还没有账号？{" "}
        <Link className="text-foreground underline underline-offset-4" href="/register">
          创建账号
        </Link>
      </FieldDescription>
    </form>
  );
}
