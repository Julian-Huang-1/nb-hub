"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
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
import { useFullSetupStore } from "@/stores/full-setup-store";

const FullSetupEditor = lazy(() =>
  import("@/components/full-setup/editor").then((module) => ({
    default: module.FullSetupEditor,
  })),
);

const preloadYooptaModules = async () => {
  await Promise.all([
    import("@yoopta/editor"),
    import("@yoopta/marks"),
    import("@yoopta/themes-shadcn"),
    import("@yoopta/ui/block-dnd"),
    import("@yoopta/ui/floating-toolbar"),
    import("@yoopta/ui/highlight-color-picker"),
    import("@yoopta/ui/selection-box"),
    import("@yoopta/ui/slash-command-menu"),
    import("@yoopta/paragraph"),
    import("@yoopta/headings"),
    import("@yoopta/lists"),
    import("@yoopta/link"),
    import("@yoopta/blockquote"),
    import("@yoopta/code"),
    import("@yoopta/divider"),
    import("@yoopta/table"),
    import("@yoopta/table-of-contents"),
    import("@yoopta/file"),
    import("@yoopta/image"),
    import("@yoopta/video"),
    import("@yoopta/embed"),
    import("@yoopta/carousel"),
    import("@yoopta/tabs"),
    import("@yoopta/steps"),
    import("@yoopta/accordion"),
    import("@yoopta/callout"),
    import("@yoopta/emoji"),
    import("@yoopta/mention"),
    import("@/components/full-setup/editor"),
  ]);
};

export default function FullSetupPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSiderCollapsed, setIsSiderCollapsed] = useState(false);
  const {
    documentId,
    historyDocuments,
    editorSeed,
    loading,
    message,
    editorInitialValue,
    initialize,
    setEditorValue,
    createDocument,
    saveDraft,
    publishDocument,
    deleteDocument,
    openFromHistory,
  } = useFullSetupStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    void preloadYooptaModules();
  }, []);

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
                onClick={() => openFromHistory(doc.id)}
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
              onClick={createDocument}
            >
              {loading === "create" ? "创建中..." : "创建文档"}
            </TopMenuBarButton>
            <TopMenuBarButton
              disabled={loading !== null || documentId === null}
              onClick={saveDraft}
            >
              {loading === "save" ? "保存中..." : "保存文档"}
            </TopMenuBarButton>
            <TopMenuBarButton
              variant="default"
              disabled={loading !== null || documentId === null}
              onClick={publishDocument}
            >
              {loading === "publish" ? "发布中..." : "发布文档"}
            </TopMenuBarButton>
            <TopMenuBarButton
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={loading !== null || documentId === null}
              onClick={deleteDocument}
            >
              {loading === "delete" ? "删除中..." : "删除文档"}
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
            <Suspense
              fallback={
                <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-gray-300 text-sm text-gray-500">
                  编辑器模块加载中...
                </div>
              }
            >
              <FullSetupEditor
                key={`${documentId ?? "new"}-${editorSeed}`}
                initialValue={editorInitialValue}
                containerBoxRef={containerRef}
                onChange={setEditorValue}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
