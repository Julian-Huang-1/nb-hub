import { useCallback, useEffect, useState, type ChangeEvent } from "react";
import type { AnkiNoteDto } from "../api/anki";
import {
  importAnkiPlainText,
  listAnkiDecks,
  listAnkiNotes,
  reviewAnkiNote,
} from "../api/anki";
import { ApiHttpError } from "../api/http";
import { AuthLoginModal } from "../components/AuthLoginModal";

function parseTags(tagsJson: string): string[] {
  try {
    const v = JSON.parse(tagsJson) as unknown;
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string") : [];
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
  const [loginOpen, setLoginOpen] = useState(false);
  const [authHint, setAuthHint] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [deckFilter, setDeckFilter] = useState<string>("");
  const [decks, setDecks] = useState<string[]>([]);
  const [notes, setNotes] = useState<AnkiNoteDto[]>([]);
  const [notesBusy, setNotesBusy] = useState(false);
  const [studyQueue, setStudyQueue] = useState<AnkiNoteDto[]>([]);
  const [studyIndex, setStudyIndex] = useState(0);
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
    setStudyIndex(0);
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
      setImportMessage("请选择 .txt 文件（Anki 导出的纯文本制表符分隔格式）。");
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

  const currentStudy = studyQueue[studyIndex] ?? null;

  const onReview = async (rating: "again" | "hard" | "good" | "easy") => {
    if (!currentStudy) return;
    setStudyBusy(true);
    try {
      await reviewAnkiNote(currentStudy.id, { rating });
      const nextQueue = studyQueue.filter((n) => n.id !== currentStudy.id);
      setStudyQueue(nextQueue);
      setStudyIndex(0);
      setShowBack(false);
      await refreshNotes();
    } catch (e) {
      if (!handleApiError(e)) setImportMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setStudyBusy(false);
    }
  };

  return (
    <main className="main anki">
      <h1 className="anki__title">Anki 记忆卡</h1>
      <p className="anki__lead">
        上传 Anki 导出的 <code>.txt</code>（制表符分隔：正面、背面，可选最后一列为标签）。支持文件中的{" "}
        <code>#deck:牌组名</code> 行切换牌组。
      </p>

      {authHint ? (
        <div className="anki__alert anki__alert-row">
          <p className="anki__alert-text">{authHint}</p>
          <button type="button" className="anki__btn anki__btn--small" onClick={() => setLoginOpen(true)}>
            登录
          </button>
        </div>
      ) : null}

      <AuthLoginModal open={loginOpen} onClose={onLoginClose} onSuccess={onLoginSuccess} />

      <section className="anki__section" aria-labelledby="anki-import-heading">
        <h2 id="anki-import-heading">导入</h2>
        <label className="anki__file-label">
          <input
            className="anki__file-input"
            type="file"
            accept=".txt,text/plain"
            disabled={importBusy}
            onChange={onPickFile}
          />
          <span className="anki__file-btn">{importBusy ? "导入中…" : "选择 .txt 文件"}</span>
        </label>
        {importMessage ? <p className="anki__hint">{importMessage}</p> : null}
      </section>

      <section className="anki__section" aria-labelledby="anki-study-heading">
        <h2 id="anki-study-heading">复习</h2>
        <div className="anki__row">
          <button type="button" className="anki__btn" disabled={studyBusy} onClick={() => void loadStudyQueue()}>
            加载待复习队列
          </button>
          <span className="anki__muted">
            {studyQueue.length ? `共 ${studyQueue.length} 张待复习` : studyBusy ? "加载中…" : "队列为空时可先导入或点击加载"}
          </span>
        </div>
        {currentStudy ? (
          <div className="anki__card">
            <p className="anki__deck">{currentStudy.deckName}</p>
            <div className="anki__face anki__face--front">
              <span className="anki__face-label">正面</span>
              <p className="anki__face-text">{currentStudy.front}</p>
            </div>
            {showBack ? (
              <div className="anki__face anki__face--back">
                <span className="anki__face-label">背面</span>
                <p className="anki__face-text">{currentStudy.back}</p>
                {parseTags(currentStudy.tagsJson).length ? (
                  <ul className="anki__tags" aria-label="标签">
                    {parseTags(currentStudy.tagsJson).map((t) => (
                      <li key={t} className="anki__tag">
                        {t}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <button type="button" className="anki__btn anki__btn--accent" onClick={() => setShowBack(true)}>
                显示答案
              </button>
            )}
            {showBack ? (
              <div className="anki__grades">
                <button type="button" className="anki__grade" disabled={studyBusy} onClick={() => void onReview("again")}>
                  重来
                </button>
                <button type="button" className="anki__grade" disabled={studyBusy} onClick={() => void onReview("hard")}>
                  困难
                </button>
                <button type="button" className="anki__grade anki__grade--good" disabled={studyBusy} onClick={() => void onReview("good")}>
                  良好
                </button>
                <button type="button" className="anki__grade" disabled={studyBusy} onClick={() => void onReview("easy")}>
                  简单
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="anki__section" aria-labelledby="anki-list-heading">
        <h2 id="anki-list-heading">牌组与笔记</h2>
        <div className="anki__row">
          <label className="anki__select-wrap">
            筛选牌组
            <select
              className="anki__select"
              value={deckFilter}
              onChange={(e) => setDeckFilter(e.target.value)}
            >
              <option value="">全部</option>
              {decks.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="anki__btn" disabled={notesBusy} onClick={() => void refreshNotes()}>
            刷新列表
          </button>
        </div>
        {notesBusy ? (
          <p className="anki__muted">加载中…</p>
        ) : notes.length === 0 ? (
          <p className="anki__muted">暂无笔记。</p>
        ) : (
          <ul className="anki__note-list">
            {notes.map((n) => (
              <li key={n.id} className="anki__note">
                <span className="anki__note-deck">{n.deckName}</span>
                <span className="anki__note-front">{n.front}</span>
                <span className="anki__note-back">{n.back}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
