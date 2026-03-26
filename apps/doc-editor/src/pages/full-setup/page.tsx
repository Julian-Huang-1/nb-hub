"use client";

import { useEffect, useRef, useState } from "react";
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
import { useFullSetupStore } from "@/stores/full-setup-store";

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
            <FullSetupEditor
              key={`${documentId ?? "new"}-${editorSeed}`}
              initialValue={editorInitialValue}
              containerBoxRef={containerRef}
              onChange={setEditorValue}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
