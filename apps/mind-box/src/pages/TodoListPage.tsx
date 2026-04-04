import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, Plus, RotateCw, Trash2 } from "lucide-react";
import type { TodoDto } from "../api/todos";
import { createTodo, deleteTodo, listTodos, updateTodo } from "../api/todos";
import { ApiHttpError } from "../api/http";
import { AuthLoginModal } from "../components/AuthLoginModal";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function TodoRow({
  item,
  busy,
  onToggle,
  onDelete,
}: {
  item: TodoDto;
  busy: boolean;
  onToggle: (item: TodoDto) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <li className="group relative">
      <div
        className={cn(
          "flex min-h-9 items-start gap-2 rounded-md px-2 py-1.5 -mx-2 transition-colors",
          "hover:bg-muted/50",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 pt-0.5">
          <input
            type="checkbox"
            className={cn(
              "mt-0.5 size-[17px] shrink-0 cursor-pointer rounded-[3px] border border-muted-foreground/35",
              "bg-background accent-foreground transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            checked={item.completed}
            disabled={busy}
            onChange={() => void onToggle(item)}
          />
          <span
            className={cn(
              "min-w-0 flex-1 text-[15px] leading-snug text-foreground selection:bg-primary/15",
              item.completed && "text-muted-foreground line-through decoration-muted-foreground/50",
            )}
          >
            {item.title}
          </span>
        </label>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive",
            "group-hover:opacity-100 group-focus-within:opacity-100",
            "max-sm:opacity-100",
          )}
          disabled={busy}
          aria-label="删除待办"
          onClick={() => void onDelete(item.id)}
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
    </li>
  );
}

export default function TodoListPage() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [authHint, setAuthHint] = useState<string | null>(null);
  const [todos, setTodos] = useState<TodoDto[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

  const { openTodos, doneTodos } = useMemo(() => {
    const open: TodoDto[] = [];
    const done: TodoDto[] = [];
    for (const t of todos) {
      if (t.completed) done.push(t);
      else open.push(t);
    }
    return { openTodos: open, doneTodos: done };
  }, [todos]);

  const handleApiError = useCallback((err: unknown) => {
    if (err instanceof ApiHttpError && err.status === 401) {
      setLoginOpen(true);
      setAuthHint(null);
      return true;
    }
    return false;
  }, []);

  const refresh = useCallback(async () => {
    setListBusy(true);
    setActionError(null);
    try {
      setAuthHint(null);
      const data = await listTodos();
      setTodos(data);
    } catch (e) {
      if (!handleApiError(e)) {
        setTodos([]);
        setActionError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setListBusy(false);
    }
  }, [handleApiError]);

  const onLoginSuccess = useCallback(async () => {
    setLoginOpen(false);
    setAuthHint(null);
    await refresh();
  }, [refresh]);

  const onLoginClose = useCallback(() => {
    setLoginOpen(false);
    setAuthHint("使用待办列表需要先登录 api-server 账号。");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setAddBusy(true);
    setActionError(null);
    try {
      const created = await createTodo({ title });
      setNewTitle("");
      setTodos((prev) => [created, ...prev]);
    } catch (e) {
      if (!handleApiError(e))
        setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setAddBusy(false);
    }
  };

  const onToggle = async (item: TodoDto) => {
    setPendingId(item.id);
    setActionError(null);
    try {
      const updated = await updateTodo(item.id, { completed: !item.completed });
      setTodos((prev) => prev.map((t) => (t.id === item.id ? updated : t)));
    } catch (e) {
      if (!handleApiError(e))
        setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setPendingId(null);
    }
  };

  const onDelete = async (id: number) => {
    setPendingId(id);
    setActionError(null);
    try {
      await deleteTodo(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      if (!handleApiError(e))
        setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <main className="flex w-full flex-1 flex-col gap-6 pb-8">
      <p className="text-sm leading-relaxed text-muted-foreground">
        与账号同步；未登录时会提示通过弹窗登录。在下方直接输入并按下 Enter 即可添加。
      </p>

      {authHint ? (
        <Alert className="rounded-md border-border/80 bg-muted/30">
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm">{authHint}</span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="shrink-0"
              onClick={() => setLoginOpen(true)}
            >
              登录
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {actionError ? (
        <Alert variant="destructive" className="rounded-md">
          <AlertDescription className="text-sm">{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <AuthLoginModal
        open={loginOpen}
        onClose={onLoginClose}
        onSuccess={onLoginSuccess}
      />

      <form
        onSubmit={onAdd}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-2 -mx-2 transition-colors",
          "hover:bg-muted/40 focus-within:bg-muted/40",
        )}
      >
        <Plus
          className="size-5 shrink-0 text-muted-foreground/80"
          strokeWidth={1.75}
          aria-hidden
        />
        <Input
          id="todo-new"
          aria-label="新建待办"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="新建待办，按 Enter 添加…"
          autoComplete="off"
          disabled={addBusy}
          className={cn(
            "h-auto min-h-8 border-0 bg-transparent py-1 text-[15px] shadow-none md:text-[15px]",
            "placeholder:text-muted-foreground/55",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
          )}
        />
        {addBusy ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
        ) : null}
      </form>

      <div className="flex items-center justify-end gap-1 border-b border-border/60 pb-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
          disabled={listBusy}
          onClick={() => void refresh()}
        >
          {listBusy ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <RotateCw className="size-3.5" aria-hidden />
          )}
          {listBusy ? "同步中…" : "刷新"}
        </Button>
      </div>

      <section className="flex flex-col" aria-labelledby="todo-list-heading">
        <h2 id="todo-list-heading" className="sr-only">
          待办列表
        </h2>

        {listBusy && todos.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">加载中…</p>
        ) : todos.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">暂无待办</p>
            <p className="mt-1 text-xs text-muted-foreground/80">在上方输入标题，按 Enter 创建第一条。</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {openTodos.length > 0 ? (
              <ul className="flex flex-col gap-0.5">
                {openTodos.map((t) => (
                  <TodoRow
                    key={t.id}
                    item={t}
                    busy={pendingId === t.id}
                    onToggle={onToggle}
                    onDelete={onDelete}
                  />
                ))}
              </ul>
            ) : null}

            {doneTodos.length > 0 ? (
              <div className="flex flex-col gap-1">
                <p className="px-2 text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
                  已完成
                </p>
                <ul className="flex flex-col gap-0.5">
                  {doneTodos.map((t) => (
                    <TodoRow
                      key={t.id}
                      item={t}
                      busy={pendingId === t.id}
                      onToggle={onToggle}
                      onDelete={onDelete}
                    />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
