"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { DocumentDto } from "@nb-hub/contracts";
import type { YooptaContentValue } from "@yoopta/editor";
import { FullSetupEditor } from "@/components/full-setup/editor";
import {
  TopMenuBar,
  TopMenuBarButton,
  TopMenuBarInner,
  TopMenuBarSection,
} from "@/components/top-menu-bar";
import {
  Sider,
  SiderContent,
  SiderHeader,
  SiderItemButton,
} from "@/components/sider";
import { cn } from "@/lib/utils";
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
  const [isSiderCollapsed, setIsSiderCollapsed] = useState(false);
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
        setHistoryDocuments(docs.map(toHistoryItem));
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
    <div>
      <Sider
        collapsible={false}
        collapsed={isSiderCollapsed}
        onCollapsedChange={setIsSiderCollapsed}
      >
        <SiderHeader>历史文档</SiderHeader>
        <SiderContent className="max-h-[calc(100vh-7rem)]">
          {historyDocuments.length === 0 ? (
            <div className="text-xs text-gray-500">暂无历史文档</div>
          ) : (
            historyDocuments.map((doc) => (
              <SiderItemButton
                key={doc.id}
                active={documentId === doc.id}
                title={doc.title}
                description={
                  <>
                    #{doc.id} | {doc.status}
                  </>
                }
                onClick={() => handleOpenFromHistory(doc.id)}
                disabled={loading !== null}
              />
            ))
          )}
        </SiderContent>
      </Sider>

      <TopMenuBar>
        <TopMenuBarInner>
          <TopMenuBarSection>
            <TopMenuBarButton
              onClick={() => setIsSiderCollapsed((value) => !value)}
            >
              {isSiderCollapsed ? "展开侧栏" : "收起侧栏"}
            </TopMenuBarButton>
          </TopMenuBarSection>
          <TopMenuBarSection className="ml-auto">
            <TopMenuBarButton
              disabled={loading !== null}
              onClick={handleCreate}
            >
              {loading === "create" ? "创建中..." : "创建文档"}
            </TopMenuBarButton>
            <TopMenuBarButton
              disabled={loading !== null || documentId === null}
              onClick={handleSaveDraft}
            >
              {loading === "save" ? "保存中..." : "保存文档"}
            </TopMenuBarButton>
            <TopMenuBarButton
              variant="default"
              disabled={loading !== null || documentId === null}
              onClick={handlePublish}
            >
              {loading === "publish" ? "发布中..." : "发布文档"}
            </TopMenuBarButton>
          </TopMenuBarSection>
        </TopMenuBarInner>
      </TopMenuBar>

      <div
        className={cn(
          "pt-20 px-4 sm:px-8 lg:pr-12",
          isSiderCollapsed ? "lg:pl-[88px]" : "lg:pl-[288px]",
        )}
      >
        <div className="mx-auto max-w-6xl">
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
