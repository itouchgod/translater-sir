"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type ImportResult = {
  imported: number;
  failed: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
};

type ImportResponse = {
  data: ImportResult | null;
  error: { message: string } | null;
};

type ImportButtonProps = {
  dictionaryId: string;
  onImported: () => void;
};

export function ImportButton({ dictionaryId, onImported }: ImportButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function upload(file: File) {
    const request = new XMLHttpRequest();
    const formData = new FormData();
    formData.set("file", file);
    setProgress(0);
    setResult(null);

    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        setProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    request.addEventListener("load", () => {
      setProgress(null);

      try {
        const payload = JSON.parse(request.responseText) as ImportResponse;

        if (request.status < 200 || request.status >= 300 || payload.error || !payload.data) {
          throw new Error(payload.error?.message ?? "导入失败");
        }

        setResult(payload.data);
        toast.success(`已导入 ${payload.data.imported} 条术语`);
        onImported();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "导入失败");
      }
    });

    request.addEventListener("error", () => {
      setProgress(null);
      toast.error("导入失败");
    });

    request.open("POST", `/api/dictionaries/${encodeURIComponent(dictionaryId)}/import`);
    request.send(formData);
  }

  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];

          if (file) {
            upload(file);
          }

          event.currentTarget.value = "";
        }}
      />
      <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
        <Upload className="size-4" />
        导入 CSV
      </Button>
      {progress !== null ? <Progress value={progress} /> : null}
      {result ? (
        <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          <p>
            成功 {result.imported} 条，失败 {result.failed} 条
          </p>
          {result.errors.slice(0, 5).map((error) => (
            <p key={`${error.row}-${error.message}`}>
              第 {error.row} 行：{error.message}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
