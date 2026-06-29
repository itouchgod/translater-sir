"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2Icon, ImageUpIcon, LoaderCircleIcon } from "lucide-react";
import Image from "next/image";
import { ChangeEvent, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { updateOrganizationAction } from "@/app/(dashboard)/settings/organization/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024;
const allowedLogoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const OrganizationNameSchema = z.object({
  name: z.string().trim().min(1, "组织名称不能为空").max(80, "组织名称不能超过 80 个字符"),
});

type OrganizationNameInput = z.infer<typeof OrganizationNameSchema>;

type OrganizationSettingsFormProps = {
  organization: {
    id: string;
    name: string;
    logoUrl: string | null;
  };
  canManage: boolean;
};

type PresignedLogoResponse = {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  expiresIn: number;
};

function assertLogoFile(file: File) {
  if (!allowedLogoTypes.has(file.type)) {
    throw new Error("Logo 仅支持 jpeg、png、webp 格式");
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    throw new Error("Logo 不能超过 5MB");
  }
}

async function uploadFileToR2(file: File, uploadUrl: string, onProgress: (value: number) => void) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(new Error("Logo 上传失败"));
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Logo 上传失败"));
    });

    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

async function requestPresignedLogo(organizationId: string, file: File) {
  const response = await fetch(`/api/organizations/${organizationId}/logo/presigned`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    }),
  });
  const payload = (await response.json()) as {
    data: PresignedLogoResponse | null;
    error: { message: string } | null;
  };

  if (!response.ok || payload.error || !payload.data) {
    throw new Error(payload.error?.message ?? "创建 Logo 上传链接失败");
  }

  return payload.data;
}

export function OrganizationSettingsForm({
  organization,
  canManage,
}: OrganizationSettingsFormProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [logoUrl, setLogoUrl] = useState(organization.logoUrl);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const form = useForm<OrganizationNameInput>({
    resolver: zodResolver(OrganizationNameSchema),
    defaultValues: {
      name: organization.name,
    },
  });

  function onSubmit(values: OrganizationNameInput) {
    startTransition(async () => {
      const result = await updateOrganizationAction(organization.id, values);

      if (!result.success) {
        toast.error(result.error ?? "更新组织失败");
        return;
      }

      form.reset({ name: values.name });
      toast.success("组织信息已更新");
    });
  }

  async function handleLogoFile(file: File) {
    try {
      assertLogoFile(file);
      setIsUploading(true);
      setUploadProgress(0);

      const presigned = await requestPresignedLogo(organization.id, file);
      await uploadFileToR2(file, presigned.uploadUrl, setUploadProgress);
      const result = await updateOrganizationAction(organization.id, {
        logoKey: presigned.key,
        logoContentType: file.type,
        logoSizeBytes: file.size,
      });

      if (!result.success) {
        throw new Error(result.error ?? "保存 Logo 失败");
      }

      setLogoUrl(result.data?.logoUrl ?? presigned.publicUrl);
      setUploadProgress(100);
      toast.success("组织 Logo 已更新");
    } catch (error: unknown) {
      setUploadProgress(0);
      toast.error(error instanceof Error ? error.message : "Logo 上传失败");
    } finally {
      setIsUploading(false);
    }
  }

  function onLogoInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file) {
      void handleLogoFile(file);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4 rounded-lg border border-dashed p-4">
        <Avatar className="size-20 rounded-lg">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={`${organization.name} Logo`}
              fill
              sizes="80px"
              className="rounded-lg object-cover"
              unoptimized
            />
          ) : null}
          <AvatarFallback className="rounded-lg">
            <Building2Icon />
          </AvatarFallback>
        </Avatar>

        <div className="flex flex-1 flex-col gap-3">
          <div>
            <p className="text-sm font-medium">组织 Logo</p>
            <p className="text-sm text-muted-foreground">支持 jpeg、png、webp，最大 5MB。</p>
          </div>
          <div>
            <Button
              type="button"
              variant="outline"
              disabled={!canManage || isUploading}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? (
                <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />
              ) : (
                <ImageUpIcon data-icon="inline-start" />
              )}
              上传 Logo
            </Button>
          </div>
          {isUploading || uploadProgress > 0 ? <Progress value={uploadProgress} /> : null}
        </div>

        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onLogoInputChange}
        />
      </div>

      <form className="flex flex-col gap-5" onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <Field data-invalid={Boolean(form.formState.errors.name)}>
            <FieldLabel htmlFor="organization-name">组织名称</FieldLabel>
            <Input
              id="organization-name"
              aria-invalid={Boolean(form.formState.errors.name)}
              disabled={!canManage || isPending}
              {...form.register("name")}
            />
            <FieldDescription>组织名称会显示在团队成员和资源归属中。</FieldDescription>
            <FieldError>{form.formState.errors.name?.message}</FieldError>
          </Field>
        </FieldGroup>

        <Button type="submit" disabled={!canManage || isPending || !form.formState.isDirty}>
          {isPending ? <LoaderCircleIcon data-icon="inline-start" className="animate-spin" /> : null}
          保存组织信息
        </Button>
      </form>
    </div>
  );
}
