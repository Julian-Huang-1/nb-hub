"use client";

import { useMemo, useRef, useState } from "react";
import type { YooptaContentValue } from "@yoopta/editor";
import { FullSetupEditor } from "@/components/full-setup/editor";
import { fullSetupInitialValue } from "./initial-value";
import { documentsApi } from "@/api/documents";

const toContentMd = (value: YooptaContentValue | null): string => {
  if (!value) {
    return "";
  }
  return JSON.stringify(value);
};

export default function FullSetupPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("Untitled document");
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [editorValue, setEditorValue] = useState<YooptaContentValue | null>(
    fullSetupInitialValue,
  );
  const [loading, setLoading] = useState<"create" | "save" | "publish" | null>(
    null,
  );
  const [message, setMessage] = useState<string>("");

  const contentMd = useMemo(() => toContentMd(editorValue), [editorValue]);

  const handleCreate = async () => {
    if (loading) {
      return;
    }
    setLoading("create");
    setMessage("");
    try {
      const doc = await documentsApi.create({
        title: title.trim() || "Untitled document",
        contentMd,
      });
      setDocumentId(doc.id);
      setMessage(`创建成功，文档 ID: ${doc.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建失败");
    } finally {
      setLoading(null);
    }
  };

  const handleSaveDraft = async () => {
    if (!documentId || loading) {
      return;
    }
    setLoading("save");
    setMessage("");
    try {
      await documentsApi.saveDraft(documentId, {
        title: title.trim() || undefined,
        contentMd,
      });
      setMessage("草稿保存成功");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setLoading(null);
    }
  };

  const handlePublish = async () => {
    if (!documentId || loading) {
      return;
    }
    setLoading("publish");
    setMessage("");
    try {
      await documentsApi.publish(documentId, {
        title: title.trim() || undefined,
        contentMd,
      });
      setMessage("发布成功");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "发布失败");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="py-6 px-4 sm:px-8 lg:px-12 max-w-5xl mx-auto">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="h-10 min-w-56 flex-1 rounded border px-3 text-sm"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="输入文档标题"
        />
        <button
          className="h-10 rounded border px-3 text-sm disabled:opacity-50"
          disabled={loading !== null}
          onClick={handleCreate}
        >
          {loading === "create" ? "创建中..." : "创建文档"}
        </button>
        <button
          className="h-10 rounded border px-3 text-sm disabled:opacity-50"
          disabled={loading !== null || documentId === null}
          onClick={handleSaveDraft}
        >
          {loading === "save" ? "保存中..." : "保存文档"}
        </button>
        <button
          className="h-10 rounded border px-3 text-sm disabled:opacity-50"
          disabled={loading !== null || documentId === null}
          onClick={handlePublish}
        >
          {loading === "publish" ? "发布中..." : "发布文档"}
        </button>
      </div>
      <div className="mb-3 text-sm text-gray-600">
        {documentId ? `当前文档 ID: ${documentId}` : "请先创建文档"}
        {message ? ` | ${message}` : ""}
      </div>
      <div
        className="py-2"
        ref={containerRef}
      >
      <FullSetupEditor
        initialValue={fullSetupInitialValue}
        containerBoxRef={containerRef}
        onChange={setEditorValue}
      />
      </div>
    </div>
  );
}
