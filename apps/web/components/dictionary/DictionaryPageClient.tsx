"use client";

import Link from "next/link";
import { BookOpen, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useDictionaries, type DictionaryListItem } from "@/hooks/useDictionaries";

type DictionaryPayload = {
  data: DictionaryListItem | null;
  error: { message: string } | null;
};

type DeletePayload = {
  data: { deleted: boolean } | null;
  error: { message: string } | null;
};

type DictionaryDialogProps = {
  dictionary?: DictionaryListItem;
  onSaved: () => void;
};

function DictionaryDialog({ dictionary, onSaved }: DictionaryDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(dictionary?.name ?? "");
  const [description, setDescription] = useState(dictionary?.description ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch(
        dictionary ? `/api/dictionaries/${encodeURIComponent(dictionary.id)}` : "/api/dictionaries",
        {
          method: dictionary ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            description,
          }),
        },
      );
      const payload = (await response.json()) as DictionaryPayload;

      if (!response.ok || payload.error || !payload.data) {
        throw new Error(payload.error?.message ?? "保存术语库失败");
      }

      toast.success(dictionary ? "术语库已更新" : "术语库已创建");
      setOpen(false);
      onSaved();

      if (!dictionary) {
        setName("");
        setDescription("");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存术语库失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={dictionary ? "outline" : "default"} size={dictionary ? "sm" : "default"}>
          {dictionary ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          {dictionary ? "编辑" : "新建术语库"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form className="grid gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{dictionary ? "编辑术语库" : "新建术语库"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor={`dictionary-name-${dictionary?.id ?? "new"}`}>名称</Label>
            <Input
              id={`dictionary-name-${dictionary?.id ?? "new"}`}
              value={name}
              onChange={(event) => setName(event.currentTarget.value)}
              maxLength={80}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`dictionary-description-${dictionary?.id ?? "new"}`}>描述</Label>
            <Textarea
              id={`dictionary-description-${dictionary?.id ?? "new"}`}
              value={description}
              onChange={(event) => setDescription(event.currentTarget.value)}
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

export function DictionaryPageClient() {
  const dictionaries = useDictionaries();

  async function setDefault(dictionary: DictionaryListItem) {
    try {
      const response = await fetch(`/api/dictionaries/${encodeURIComponent(dictionary.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isDefault: true }),
      });
      const payload = (await response.json()) as DictionaryPayload;

      if (!response.ok || payload.error || !payload.data) {
        throw new Error(payload.error?.message ?? "设置默认术语库失败");
      }

      toast.success("默认术语库已更新");
      await dictionaries.mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "设置默认术语库失败");
    }
  }

  async function deleteDictionary(dictionary: DictionaryListItem) {
    if (!window.confirm("确定删除这个术语库及其全部术语吗？")) {
      return;
    }

    try {
      const response = await fetch(`/api/dictionaries/${encodeURIComponent(dictionary.id)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as DeletePayload;

      if (!response.ok || payload.error || !payload.data?.deleted) {
        throw new Error(payload.error?.message ?? "删除术语库失败");
      }

      toast.success("术语库已删除");
      await dictionaries.mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除术语库失败");
    }
  }

  const items = dictionaries.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-normal">企业词典</h1>
          <p className="text-sm text-muted-foreground">管理组织内翻译优先使用的专业术语。</p>
        </div>
        <DictionaryDialog onSaved={() => void dictionaries.mutate()} />
      </div>

      <div className="grid gap-3">
        {items.map((dictionary) => (
          <Card key={dictionary.id}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookOpen className="size-5 text-muted-foreground" />
                <CardTitle>{dictionary.name}</CardTitle>
                {dictionary.isDefault ? <Badge>默认</Badge> : null}
              </div>
              <CardDescription>{dictionary.description || "暂无描述"}</CardDescription>
              <CardAction>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dictionary/${dictionary.id}`}>管理术语</Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-muted-foreground">{dictionary._count.terms} 条术语</p>
              <div className="flex flex-wrap gap-2">
                <DictionaryDialog dictionary={dictionary} onSaved={() => void dictionaries.mutate()} />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={dictionary.isDefault}
                  onClick={() => void setDefault(dictionary)}
                >
                  <Star className="size-4" />
                  设为默认
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={dictionary.isDefault}
                  onClick={() => void deleteDictionary(dictionary)}
                >
                  <Trash2 className="size-4" />
                  删除
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!dictionaries.isLoading && items.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          暂无术语库
        </div>
      ) : null}
    </div>
  );
}
