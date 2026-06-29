"use client";

import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { DictionaryTermItem } from "@/hooks/useDictionaryTerms";
import { SUPPORTED_LANGUAGE_PAIRS } from "@/utils/languages";

type ApiPayload = {
  data: DictionaryTermItem | null;
  error: { message: string } | null;
};

type TermFormProps = {
  dictionaryId: string;
  term?: DictionaryTermItem;
  onSaved: () => void;
};

export function TermForm({ dictionaryId, term, onSaved }: TermFormProps) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState(term?.source ?? "");
  const [target, setTarget] = useState(term?.target ?? "");
  const [language, setLanguage] = useState(term?.language ?? "zh-en");
  const [notes, setNotes] = useState(term?.notes ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(
        term
          ? `/api/dictionaries/${encodeURIComponent(dictionaryId)}/terms/${encodeURIComponent(term.id)}`
          : `/api/dictionaries/${encodeURIComponent(dictionaryId)}/terms`,
        {
          method: term ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            source,
            target,
            language,
            notes,
          }),
        },
      );
      const payload = (await response.json()) as ApiPayload;

      if (!response.ok || payload.error || !payload.data) {
        throw new Error(payload.error?.message ?? "保存术语失败");
      }

      toast.success(term ? "术语已更新" : "术语已添加");
      setOpen(false);
      onSaved();

      if (!term) {
        setSource("");
        setTarget("");
        setNotes("");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存术语失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size={term ? "sm" : "default"} variant={term ? "outline" : "default"}>
          {term ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          {term ? "编辑" : "添加术语"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form className="grid gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{term ? "编辑术语" : "添加术语"}</DialogTitle>
            <DialogDescription>术语会在下一次翻译请求中生效。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor={`term-source-${term?.id ?? "new"}`}>原文</Label>
            <Input
              id={`term-source-${term?.id ?? "new"}`}
              value={source}
              onChange={(event) => setSource(event.currentTarget.value)}
              maxLength={200}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`term-target-${term?.id ?? "new"}`}>译文</Label>
            <Input
              id={`term-target-${term?.id ?? "new"}`}
              value={target}
              onChange={(event) => setTarget(event.currentTarget.value)}
              maxLength={200}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>语言对</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
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

          <div className="grid gap-2">
            <Label htmlFor={`term-notes-${term?.id ?? "new"}`}>备注</Label>
            <Textarea
              id={`term-notes-${term?.id ?? "new"}`}
              value={notes}
              onChange={(event) => setNotes(event.currentTarget.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "保存中" : "保存"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
