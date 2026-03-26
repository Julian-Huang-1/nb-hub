import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth-client";

type AuthMode = "sign-in" | "sign-up";

export function AuthPage({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      if (mode === "sign-up") {
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        if (result.error) {
          setMessage(result.error.message ?? "注册失败");
          return;
        }
      } else {
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (result.error) {
          setMessage(result.error.message ?? "登录失败");
          return;
        }
      }
      onAuthed();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="mx-auto w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900">
          {mode === "sign-in" ? "登录 Doc Editor" : "注册 Doc Editor"}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {mode === "sign-in" ? "登录后可访问你的私有文档与会话。" : "创建账号后自动登录。"}
        </p>

        <form className="mt-6 space-y-4" onSubmit={submit}>
          {mode === "sign-up" ? (
            <label className="block">
              <span className="mb-1 block text-sm text-gray-700">昵称</span>
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
          ) : null}
          <label className="block">
            <span className="mb-1 block text-sm text-gray-700">邮箱</span>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-gray-700">密码</span>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              required
            />
          </label>

          {message ? <p className="text-sm text-red-600">{message}</p> : null}

          <button
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {loading ? "提交中..." : mode === "sign-in" ? "登录" : "注册并登录"}
          </button>
        </form>

        <div className="mt-4 text-sm text-gray-600">
          {mode === "sign-in" ? "还没有账号？" : "已有账号？"}
          <button
            className="ml-1 text-gray-900 underline"
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setMessage("");
            }}
            type="button"
          >
            {mode === "sign-in" ? "去注册" : "去登录"}
          </button>
        </div>
      </div>
    </div>
  );
}
