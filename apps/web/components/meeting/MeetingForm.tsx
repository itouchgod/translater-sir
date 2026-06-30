"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SUPPORTED_LANGUAGE_PAIRS } from "@/utils/languages";

type MeetingFormProps = {
  mode: "create" | "edit";
  meetingId?: string;
  initialValues?: {
    title: string;
    sourceLanguage: string;
    targetLanguage: string;
  };
};

type ApiPayload = {
  data: { id: string } | null;
  error: { code?: string; message: string } | null;
};

export function MeetingForm({ mode, meetingId, initialValues }: MeetingFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [languagePair, setLanguagePair] = useState(
    `${initialValues?.sourceLanguage ?? "zh"}-${initialValues?.targetLanguage ?? "en"}`,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setErrorCode(null);

    const [sourceLanguage, targetLanguage] = languagePair.split("-");
    const response = await fetch(
      mode === "create" ? "/api/meetings" : `/api/meetings/${encodeURIComponent(meetingId ?? "")}`,
      {
        method: mode === "create" ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          sourceLanguage,
          targetLanguage,
        }),
      },
    );
    const payload = (await response.json()) as ApiPayload;
    setIsSubmitting(false);

    if (!response.ok || payload.error || !payload.data) {
      setError(payload.error?.message ?? "保存会议失败");
      setErrorCode(payload.error?.code ?? null);
      return;
    }

    router.push(`/meetings/${payload.data.id}`);
    router.refresh();
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-2">
        <Label htmlFor="meeting-title">标题</Label>
        <Input
          id="meeting-title"
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
          placeholder="例如：产品周会"
          required
          maxLength={120}
        />
      </div>

      <div className="grid gap-2">
        <Label>语言对</Label>
        <Select value={languagePair} onValueChange={setLanguagePair}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGE_PAIRS.map((pair) => (
              <SelectItem key={`${pair.source}-${pair.target}`} value={`${pair.source}-${pair.target}`}>
                {pair.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="grid gap-2 text-sm text-red-600">
          <p>{error}</p>
          {errorCode === "QUOTA_EXCEEDED" ? (
            <Button asChild variant="outline" size="sm" className="w-fit">
              <Link href="/billing/plans">查看可升级计划</Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          取消
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "保存中" : mode === "create" ? "创建会议" : "保存修改"}
        </Button>
      </div>
    </form>
  );
}
