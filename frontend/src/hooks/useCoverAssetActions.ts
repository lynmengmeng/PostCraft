"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import type { ContentProject, CoverAsset } from "@/lib/types";

export function useCoverAssetActions(
  projectId: string,
  asset: CoverAsset | undefined,
  assetIndex: number,
  onUpdate?: (project: ContentProject) => void,
  fallbackCaption?: string,
) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload(file: File) {
    if (!onUpdate) return;
    setUploading(true);
    setError("");
    try {
      const saved = await api.uploadAsset(projectId, file, {
        caption: asset?.caption || asset?.subheadline || fallbackCaption,
        insertPlaceholder: false,
        assetIndex,
      });
      onUpdate(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleGenerate() {
    if (!onUpdate) return;
    setGenerating(true);
    setError("");
    try {
      const saved = await api.generateAssetImage(projectId, assetIndex);
      onUpdate(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成失败");
    } finally {
      setGenerating(false);
    }
  }

  return {
    fileInputRef,
    uploading,
    generating,
    error,
    handleUpload,
    handleGenerate,
    openFilePicker: () => fileInputRef.current?.click(),
  };
}
