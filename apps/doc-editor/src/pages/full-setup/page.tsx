"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DocumentDto } from "@nb-hub/contracts";
import type { YooptaContentValue } from "@yoopta/editor";
import { FullSetupEditor } from "@/components/full-setup/editor";
import { fullSetupInitialValue } from "./initial-value";
import { documentsApi } from "@/api/documents";

type HistoryDocumentItem = Pick<
  DocumentDto,
  "id" | "title" | "status" | "updatedAt"
>;

const toContentMd = (value: YooptaContentValue | null): string => {
  if (!value) {
    return "";
  }
  return JSON.stringify(value);
};

const parseContentMd = (
  value: string | undefined,
): YooptaContentValue | null => {
  if (!value) {
    return fullSetupInitialValue;
  }
  try {
    return JSON.parse(value) as YooptaContentValue;
  } catch {
    return fullSetupInitialValue;
  }
};

const toHistoryItem = (doc: DocumentDto): HistoryDocumentItem => ({
  id: doc.id,
  title: doc.title,
  status: doc.status,
  updatedAt: doc.updatedAt,
});

export default function FullSetupPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState("Untitled document");
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [historyDocuments, setHistoryDocuments] = useState<
    HistoryDocumentItem[]
  >([]);
  const [editorSeed, setEditorSeed] = useState(0);
  const [editorInitialValue, setEditorInitialValue] =
    useState<YooptaContentValue | null>(fullSetupInitialValue);
  const [editorValue, setEditorValue] = useState<YooptaContentValue | null>(
    fullSetupInitialValue,
  );
  const [loading, setLoading] = useState<
    "create" | "save" | "publish" | "load" | null
  >(null);
  const [message, setMessage] = useState<string>("");

  const contentMd = useMemo(() => toContentMd(editorValue), [editorValue]);

  useEffect(() => {
    let cancelled = false;
    const loadList = async () => {
      try {
        const docs = await documentsApi.list();
        if (cancelled) {
          return;
        }
        setHistoryDocuments(
          docs.sort((a, b) => a.id - b.id).map(toHistoryItem),
        );
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error ? error.message : "加载文档列表失败",
          );
        }
      }
    };
    loadList();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshDocumentsList = async () => {
    const docs = await documentsApi.list();
    setHistoryDocuments(docs.map(toHistoryItem));
  };

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
      await refreshDocumentsList();
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
      const result = await documentsApi.saveDraft(documentId, {
        title: title.trim() || undefined,
        contentMd,
      });
      const latestDoc = result.document;
      if (latestDoc) {
        await refreshDocumentsList();
      }
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
      const result = await documentsApi.publish(documentId, {
        title: title.trim() || undefined,
        contentMd,
      });
      const latestDoc = result.document;
      if (latestDoc) {
        await refreshDocumentsList();
      }
      setMessage("发布成功");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "发布失败");
    } finally {
      setLoading(null);
    }
  };

  const handleOpenFromHistory = async (id: number) => {
    if (loading) {
      return;
    }
    setLoading("load");
    setMessage("");
    try {
      const data = await documentsApi.getById(id);
      setDocumentId(data.document.id);
      setTitle(data.document.title);
      const nextValue = parseContentMd(data.currentVersion?.contentMd);
      setEditorInitialValue(nextValue);
      setEditorValue(nextValue);
      setEditorSeed((seed) => seed + 1);
      setMessage(`已打开文档 #${data.document.id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-8 lg:px-12">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="h-fit rounded border bg-white p-3">
          <div className="mb-2 text-sm font-medium">历史文档</div>
          <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {historyDocuments.length === 0 ? (
              <div className="text-xs text-gray-500">暂无历史文档</div>
            ) : (
              historyDocuments.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  className={`w-full rounded border px-2 py-2 text-left text-xs hover:bg-gray-50 ${
                    documentId === doc.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200"
                  }`}
                  onClick={() => handleOpenFromHistory(doc.id)}
                  disabled={loading !== null}
                >
                  <div className="truncate text-sm font-medium text-gray-900">
                    {doc.title}
                  </div>
                  <div className="mt-1 text-gray-500">
                    #{doc.id} | {doc.status}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <div>
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

          <div className="py-2" ref={containerRef}>
            <FullSetupEditor
              key={`${documentId ?? "new"}-${editorSeed}`}
              initialValue={editorInitialValue ?? fullSetupInitialValue}
              containerBoxRef={containerRef}
              onChange={setEditorValue}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
