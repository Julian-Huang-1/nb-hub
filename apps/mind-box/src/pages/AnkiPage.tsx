import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import type { AnkiNoteDto } from "../api/anki";
import {
  importAnkiPlainText,
  listAnkiDecks,
  listAnkiNotes,
  reviewAnkiNote,
} from "../api/anki";
import { ApiHttpError } from "../api/http";
import { AuthLoginModal } from "../components/AuthLoginModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

const DECK_ALL_VALUE = "__all__";

function parseTags(tagsJson: string): string[] {
  try {
    const v = JSON.parse(tagsJson) as unknown;
    return Array.isArray(v)
      ? v.filter((t): t is string => typeof t === "string")
      : [];
  } catch {
    return [];
  }
}

function shuffleInPlace<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

export default function AnkiPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [authHint, setAuthHint] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [deckFilter, setDeckFilter] = useState<string>("");
  const [decks, setDecks] = useState<string[]>([]);
  const [notes, setNotes] = useState<AnkiNoteDto[]>([]);
  const [notesBusy, setNotesBusy] = useState(false);
  const [studyQueue, setStudyQueue] = useState<AnkiNoteDto[]>([]);
  const [showBack, setShowBack] = useState(false);
  const [studyBusy, setStudyBusy] = useState(false);

  const handleApiError = useCallback((err: unknown) => {
    if (err instanceof ApiHttpError && err.status === 401) {
      setLoginOpen(true);
      setAuthHint(null);
      return true;
    }
    return false;
  }, []);

  const refreshDecks = useCallback(async () => {
    try {
      setAuthHint(null);
      const d = await listAnkiDecks();
      setDecks(d);
    } catch (e) {
      if (!handleApiError(e)) setDecks([]);
    }
  }, [handleApiError]);

  const refreshNotes = useCallback(async () => {
    setNotesBusy(true);
    try {
      setAuthHint(null);
      const list = await listAnkiNotes({
        deck: deckFilter || undefined,
        limit: 200,
        dueOnly: false,
      });
      setNotes(list);
    } catch (e) {
      if (!handleApiError(e)) setNotes([]);
    } finally {
      setNotesBusy(false);
    }
  }, [deckFilter, handleApiError]);

  const loadStudyQueue = useCallback(async () => {
    setStudyBusy(true);
    setShowBack(false);
    try {
      setAuthHint(null);
      const due = await listAnkiNotes({
        deck: deckFilter || undefined,
        limit: 200,
        dueOnly: true,
      });
      const copy = [...due];
      shuffleInPlace(copy);
      setStudyQueue(copy);
    } catch (e) {
      if (!handleApiError(e)) setStudyQueue([]);
    } finally {
      setStudyBusy(false);
    }
  }, [deckFilter, handleApiError]);

  const onLoginSuccess = useCallback(async () => {
    setLoginOpen(false);
    setAuthHint(null);
    await refreshDecks();
    await refreshNotes();
    await loadStudyQueue();
  }, [refreshDecks, refreshNotes, loadStudyQueue]);

  const onLoginClose = useCallback(() => {
    setLoginOpen(false);
    setAuthHint("使用 Anki 相关功能需要先登录 api-server 账号。");
  }, []);

  useEffect(() => {
    void refreshDecks();
  }, [refreshDecks]);

  useEffect(() => {
    void refreshNotes();
  }, [refreshNotes]);

  const onPickFile = async (ev: ChangeEvent<HTMLInputElement>) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".txt")) {
      setImportMessage(
        "请选择 .txt 文件（Anki 导出的纯文本制表符分隔格式）。",
      );
      return;
    }
    setImportBusy(true);
    setImportMessage(null);
    try {
      const text = await file.text();
      const data = await importAnkiPlainText({ text });
      setImportMessage(
        `已导入 ${data.imported} 条笔记，涉及牌组：${data.decks.length ? data.decks.join("、") : "（默认）"}。`,
      );
      await refreshDecks();
      await refreshNotes();
      await loadStudyQueue();
    } catch (e) {
      if (handleApiError(e)) return;
      setImportMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setImportBusy(false);
    }
  };

  const currentStudy = studyQueue[0] ?? null;

  const onReview = async (rating: "again" | "hard" | "good" | "easy") => {
    if (!currentStudy) return;
    setStudyBusy(true);
    try {
      await reviewAnkiNote(currentStudy.id, { rating });
      const nextQueue = studyQueue.filter((n) => n.id !== currentStudy.id);
      setStudyQueue(nextQueue);
      setShowBack(false);
      await refreshNotes();
    } catch (e) {
      if (!handleApiError(e))
        setImportMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setStudyBusy(false);
    }
  };

  return (
    <main className="flex w-full flex-1 flex-col gap-8 pb-8">
      <p className="leading-relaxed text-muted-foreground">
        上传 Anki 导出的 <code className="rounded-md bg-muted px-1.5 py-0.5 text-sm">.txt</code>
        （制表符分隔：正面、背面，可选最后一列为标签）。支持文件中的{" "}
        <code className="rounded-md bg-muted px-1.5 py-0.5 text-sm">
          #deck:牌组名
        </code>{" "}
        行切换牌组。
      </p>

      {authHint ? (
        <Alert>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{authHint}</span>
            <Button
              type="button"
              size="sm"
              className="shrink-0"
              onClick={() => setLoginOpen(true)}
            >
              登录
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <AuthLoginModal
        open={loginOpen}
        onClose={onLoginClose}
        onSuccess={onLoginSuccess}
      />

      <input
        ref={fileInputRef}
        className="sr-only"
        type="file"
        accept=".txt,text/plain"
        disabled={importBusy}
        onChange={onPickFile}
        aria-hidden
      />

      <section className="flex flex-col gap-3" aria-labelledby="anki-import-heading">
        <h2
          id="anki-import-heading"
          className="text-base font-medium text-foreground"
        >
          导入
        </h2>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={importBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            {importBusy ? (
              <>
                <Spinner data-icon="inline-start" />
                导入中…
              </>
            ) : (
              "选择 .txt 文件"
            )}
          </Button>
          {importMessage ? (
            <p className="text-sm text-muted-foreground">{importMessage}</p>
          ) : null}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="anki-study-heading">
        <h2
          id="anki-study-heading"
          className="text-base font-medium text-foreground"
        >
          复习
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={studyBusy}
            onClick={() => void loadStudyQueue()}
          >
            {studyBusy ? (
              <>
                <Spinner data-icon="inline-start" />
                加载中…
              </>
            ) : (
              "加载待复习队列"
            )}
          </Button>
          <span className="text-sm text-muted-foreground">
            {studyQueue.length
              ? `共 ${studyQueue.length} 张待复习`
              : studyBusy
                ? "加载中…"
                : "队列为空时可先导入或点击加载"}
          </span>
        </div>
        {currentStudy ? (
          <Card>
            <CardHeader className="gap-2 pb-2">
              <p className="text-xs text-muted-foreground">
                {currentStudy.deckName}
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  正面
                </span>
                <p className="whitespace-pre-wrap text-foreground">
                  {currentStudy.front}
                </p>
              </div>
              {showBack ? (
                <>
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      背面
                    </span>
                    <p className="whitespace-pre-wrap text-muted-foreground">
                      {currentStudy.back}
                    </p>
                    {parseTags(currentStudy.tagsJson).length ? (
                      <ul className="flex flex-wrap gap-1.5" aria-label="标签">
                        {parseTags(currentStudy.tagsJson).map((t) => (
                          <li key={t}>
                            <Badge variant="secondary">{t}</Badge>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={studyBusy}
                      onClick={() => void onReview("again")}
                    >
                      重来
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={studyBusy}
                      onClick={() => void onReview("hard")}
                    >
                      困难
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={studyBusy}
                      onClick={() => void onReview("good")}
                    >
                      良好
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={studyBusy}
                      onClick={() => void onReview("easy")}
                    >
                      简单
                    </Button>
                  </div>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={() => setShowBack(true)}
                >
                  显示答案
                </Button>
              )}
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="anki-list-heading">
        <h2
          id="anki-list-heading"
          className="text-base font-medium text-foreground"
        >
          牌组与笔记
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="deck-select">筛选牌组</Label>
            <Select
              value={deckFilter || DECK_ALL_VALUE}
              onValueChange={(v) =>
                setDeckFilter(v === DECK_ALL_VALUE ? "" : v)
              }
            >
              <SelectTrigger id="deck-select" className="w-[min(100%,12rem)]">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value={DECK_ALL_VALUE}>全部</SelectItem>
                  {decks.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={notesBusy}
            onClick={() => void refreshNotes()}
          >
            {notesBusy ? (
              <>
                <Spinner data-icon="inline-start" />
                刷新中…
              </>
            ) : (
              "刷新列表"
            )}
          </Button>
        </div>
        {notesBusy ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无笔记。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((n) => (
              <li key={n.id}>
                <Card size="sm">
                  <CardHeader className="pb-0">
                    <p className="text-xs text-muted-foreground">{n.deckName}</p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-1 pt-2">
                    <span className="text-sm font-medium text-foreground">
                      {n.front}
                    </span>
                    <span className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {n.back}
                    </span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
