"use client";

import { Download, FileAudio, FileText, FileVideo, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMeetingFiles, type MeetingFileItem } from "@/hooks/useMeetingFiles";

type FileListProps = {
  meetingId: string;
  initialFiles?: MeetingFileItem[];
};

type DeleteResponse = {
  data: { deleted: boolean } | null;
  error: { message: string } | null;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function FileIcon({ type }: { type: string }) {
  if (type === "AUDIO") {
    return <FileAudio className="size-5 text-red-600" />;
  }

  if (type === "VIDEO") {
    return <FileVideo className="size-5 text-blue-600" />;
  }

  if (type.startsWith("SUMMARY") || type === "TRANSCRIPT") {
    return <FileText className="size-5 text-emerald-700" />;
  }

  return <Paperclip className="size-5 text-muted-foreground" />;
}

export function FileList({ meetingId, initialFiles }: FileListProps) {
  const files = useMeetingFiles(meetingId, initialFiles);
  const items = files.data ?? [];

  async function deleteFile(fileId: string) {
    if (!window.confirm("确定删除这个文件吗？")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/meetings/${encodeURIComponent(meetingId)}/files/${encodeURIComponent(fileId)}`,
        {
          method: "DELETE",
        },
      );
      const payload = (await response.json()) as DeleteResponse;

      if (!response.ok || payload.error || !payload.data?.deleted) {
        throw new Error(payload.error?.message ?? "删除文件失败");
      }

      toast.success("文件已删除");
      await files.mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除文件失败");
    }
  }

  return (
    <div className="grid gap-2">
      {items.map((file) => (
        <div key={file.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div className="flex min-w-0 items-center gap-3">
            <FileIcon type={file.type} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {file.type} · {formatBytes(file.sizeBytes)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`/api/download/${file.id}`}>
                <Download className="size-4" />
                下载
              </a>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => void deleteFile(file.id)}>
              <Trash2 className="size-4" />
              删除
            </Button>
          </div>
        </div>
      ))}

      {!files.isLoading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无文件</p>
      ) : null}
    </div>
  );
}
