import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { TodoDto } from "../api/todos";
import { createTodo, deleteTodo, listTodos, updateTodo } from "../api/todos";
import { ApiHttpError } from "../api/http";
import { AuthLoginModal } from "../components/AuthLoginModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export default function TodoListPage() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [authHint, setAuthHint] = useState<string | null>(null);
  const [todos, setTodos] = useState<TodoDto[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);

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
    <main className="flex w-full flex-1 flex-col gap-8 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          待办
        </h1>
        <p className="mt-2 leading-relaxed text-muted-foreground">
          与账号同步的简易待办；未登录时会提示通过弹窗登录。
        </p>
      </div>

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

      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <AuthLoginModal
        open={loginOpen}
        onClose={onLoginClose}
        onSuccess={onLoginSuccess}
      />

      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={onAdd}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor="todo-new">新待办</Label>
          <Input
            id="todo-new"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="输入标题后回车或点击添加"
            autoComplete="off"
            disabled={addBusy}
          />
        </div>
        <Button type="submit" disabled={addBusy || !newTitle.trim()}>
          {addBusy ? (
            <>
              <Spinner data-icon="inline-start" />
              添加中…
            </>
          ) : (
            "添加"
          )}
        </Button>
      </form>

      <section className="flex flex-col gap-3" aria-labelledby="todo-list-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="todo-list-heading"
            className="text-base font-medium text-foreground"
          >
            列表
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={listBusy}
            onClick={() => void refresh()}
          >
            {listBusy ? (
              <>
                <Spinner data-icon="inline-start" />
                刷新中…
              </>
            ) : (
              "刷新"
            )}
          </Button>
        </div>

        {listBusy && todos.length === 0 ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : todos.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无待办，先添加一条吧。</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {todos.map((t) => (
              <li key={t.id}>
                <Card size="sm">
                  <CardContent className="flex flex-wrap items-center gap-3 pt-4">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 rounded border border-input accent-primary"
                        checked={t.completed}
                        disabled={pendingId === t.id}
                        onChange={() => void onToggle(t)}
                      />
                      <span
                        className={
                          t.completed
                            ? "text-sm text-muted-foreground line-through"
                            : "text-sm text-foreground"
                        }
                      >
                        {t.title}
                      </span>
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-destructive hover:text-destructive"
                      disabled={pendingId === t.id}
                      onClick={() => void onDelete(t.id)}
                    >
                      删除
                    </Button>
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
