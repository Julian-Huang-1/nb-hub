import { create } from "zustand";
import type { DocumentDto } from "@nb-hub/contracts";
import type { YooptaContentValue } from "@yoopta/editor";
import { documentsApi } from "@/api/documents";
import { fullSetupInitialValue } from "@/pages/full-setup/initial-value";
import { ensureLockedTitleBlock } from "@/pages/full-setup/locked-title-block";

type HistoryDocumentItem = Pick<
  DocumentDto,
  "id" | "title" | "status" | "updatedAt"
>;

type LoadingState = "create" | "save" | "publish" | "load" | "delete" | null;

type FullSetupStore = {
  // 当前文档标题（用于保存/发布时提交）
  title: string;
  // 当前打开的文档 ID（未创建时为 null）
  documentId: number | null;
  // 左侧历史文档列表数据
  historyDocuments: HistoryDocumentItem[];
  // 控制编辑器重挂载的种子值（切换文档时递增）
  editorSeed: number;
  // 编辑器当前实时值（用于保存/发布）
  editorValue: YooptaContentValue | null;
  // 编辑器初始化值（用于重新打开文档时回填）
  editorInitialValue: YooptaContentValue | null;
  // 当前异步操作状态（用于按钮 loading/禁用）
  loading: LoadingState;
  // 页面操作提示信息
  message: string;
  // 是否已完成首次初始化（避免重复拉取列表）
  initialized: boolean;
  // 初始化：拉取历史文档列表
  initialize: () => Promise<void>;
  // 更新编辑器内容（内部会强制补齐 title-block）
  setEditorValue: (value: YooptaContentValue) => void;
  // 创建新文档
  createDocument: () => Promise<void>;
  // 保存草稿
  saveDraft: () => Promise<void>;
  // 发布文档
  publishDocument: () => Promise<void>;
  // 从历史列表打开指定文档
  openFromHistory: (id: number) => Promise<void>;
  // 删除当前文档
  deleteDocument: () => Promise<void>;
};

export const defaultEditorValue = ensureLockedTitleBlock(fullSetupInitialValue);

const toContentMd = (value: YooptaContentValue | null): string => {
  if (!value) {
    return "";
  }
  return JSON.stringify(value);
};

const parseContentMd = (value: string | undefined): YooptaContentValue => {
  if (!value) {
    return defaultEditorValue;
  }
  try {
    return ensureLockedTitleBlock(JSON.parse(value) as YooptaContentValue);
  } catch {
    return defaultEditorValue;
  }
};

const toHistoryItem = (doc: DocumentDto): HistoryDocumentItem => ({
  id: doc.id,
  title: doc.title,
  status: doc.status,
  updatedAt: doc.updatedAt,
});

const cloneEditorValue = (value: YooptaContentValue): YooptaContentValue => {
  return structuredClone(value) as YooptaContentValue;
};

export const useFullSetupStore = create<FullSetupStore>((set, get) => ({
  title: "Untitled document",
  documentId: null,
  historyDocuments: [],
  editorSeed: 0,
  editorValue: null,
  editorInitialValue: null,
  loading: null,
  message: "",
  initialized: false,

  initialize: async () => {
    if (get().initialized) {
      return;
    }

    try {
      const docs = await documentsApi.list();
      set({
        historyDocuments: docs.map(toHistoryItem),
        initialized: true,
      });
    } catch (error) {
      set({
        message: error instanceof Error ? error.message : "加载文档列表失败",
        initialized: true,
      });
    }
  },

  setEditorValue: (value) => {
    const newEditorValue = ensureLockedTitleBlock(value);
    set({ editorValue: newEditorValue });

    const newTitle =
      (newEditorValue["title-block"] as any)?.value?.[0]?.children?.[0]?.text ??
      "未命名文档";

    if (get().title !== newTitle) {
      set({
        title: newTitle,
        historyDocuments: get().historyDocuments.map((doc) => {
          if (doc.id === get().documentId) {
            return {
              ...doc,
              title: newTitle,
            };
          }
          return doc;
        }),
      });
    }
  },

  createDocument: async () => {
    if (get().loading) {
      return;
    }

    set({ loading: "create", message: "" });

    try {
      const doc = await documentsApi.create({
        title: "未命名文档",
        contentMd: JSON.stringify(defaultEditorValue),
      });
      const docs = await documentsApi.list();

      set({
        documentId: doc.id,
        historyDocuments: docs.map(toHistoryItem),
        message: `创建成功，文档 ID: ${doc.id}`,
        editorValue: cloneEditorValue(defaultEditorValue),
      });
    } catch (error) {
      set({ message: error instanceof Error ? error.message : "创建失败" });
    } finally {
      set({ loading: null });
    }
  },

  saveDraft: async () => {
    const { documentId, loading, title, editorValue } = get();
    if (!documentId || loading) {
      return;
    }

    set({ loading: "save", message: "" });

    try {
      const result = await documentsApi.saveDraft(documentId, {
        title: title.trim() || undefined,
        contentMd: toContentMd(editorValue),
      });

      if (result.document) {
        const docs = await documentsApi.list();
        set({ historyDocuments: docs.map(toHistoryItem) });
      }

      set({ message: "草稿保存成功" });
    } catch (error) {
      set({ message: error instanceof Error ? error.message : "保存失败" });
    } finally {
      set({ loading: null });
    }
  },

  publishDocument: async () => {
    const { documentId, loading, title, editorValue } = get();
    if (!documentId || loading) {
      return;
    }

    set({ loading: "publish", message: "" });

    try {
      const result = await documentsApi.publish(documentId, {
        title: title.trim() || undefined,
        contentMd: toContentMd(editorValue),
      });

      if (result.document) {
        const docs = await documentsApi.list();
        set({ historyDocuments: docs.map(toHistoryItem) });
      }

      set({ message: "发布成功" });
    } catch (error) {
      set({ message: error instanceof Error ? error.message : "发布失败" });
    } finally {
      set({ loading: null });
    }
  },

  openFromHistory: async (id) => {
    if (get().loading) {
      return;
    }

    set({ loading: "load", message: "" });

    try {
      const data = await documentsApi.getById(id);
      const nextValue = parseContentMd(data.currentVersion?.contentMd);

      set((state) => ({
        documentId: data.document.id,
        title: data.document.title,
        editorValue: nextValue,
        editorInitialValue: nextValue,
        editorSeed: state.editorSeed + 1,
        message: `已打开文档 #${data.document.id}`,
      }));
    } catch (error) {
      set({ message: error instanceof Error ? error.message : "加载失败" });
    } finally {
      set({ loading: null });
    }
  },

  deleteDocument: async () => {
    const { documentId, loading } = get();
    if (!documentId || loading) {
      return;
    }

    set({ loading: "delete", message: "" });

    try {
      await documentsApi.deleteById(documentId);
      const docs = await documentsApi.list();

      set((state) => ({
        documentId: null,
        title: "Untitled document",
        editorValue: cloneEditorValue(defaultEditorValue),
        editorInitialValue: cloneEditorValue(defaultEditorValue),
        editorSeed: state.editorSeed + 1,
        historyDocuments: docs.map(toHistoryItem),
        message: `已删除文档 #${documentId}`,
      }));
    } catch (error) {
      set({ message: error instanceof Error ? error.message : "删除失败" });
    } finally {
      set({ loading: null });
    }
  },
}));

if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as any).__fullSetupStore = useFullSetupStore;
}
