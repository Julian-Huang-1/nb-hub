import { useEffect, useState, type FormEvent } from "react";
import { getApiBase } from "../env";
import { authClient } from "../lib/auth-client";

type AuthMode = "sign-in" | "sign-up";

type AuthLoginModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function AuthLoginModal({ open, onClose, onSuccess }: AuthLoginModalProps) {
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) {
      setMessage("");
      setName("");
      setEmail("");
      setPassword("");
      setMode("sign-in");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    if (!getApiBase()) {
      setMessage("未配置 VITE_API_BASE_URL，无法连接 api-server。");
      return;
    }
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
      onSuccess();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal" role="presentation">
      <div className="auth-modal__backdrop" aria-hidden="true" onClick={onClose} />
      <div
        className="auth-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="auth-modal__head">
          <h2 id="auth-modal-title" className="auth-modal__title">
            {mode === "sign-in" ? "登录" : "注册"}
          </h2>
          <button type="button" className="auth-modal__close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <p className="auth-modal__lead">
          使用与 api-server 相同的账号登录后，即可使用 Anki 等需鉴权的接口（Cookie 将写入当前站点可访问的域）。
        </p>

        <form className="auth-modal__form" onSubmit={submit}>
          {mode === "sign-up" ? (
            <label className="auth-modal__field">
              <span className="auth-modal__label">昵称</span>
              <input
                className="auth-modal__input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
          ) : null}
          <label className="auth-modal__field">
            <span className="auth-modal__label">邮箱</span>
            <input
              className="auth-modal__input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label className="auth-modal__field">
            <span className="auth-modal__label">密码</span>
            <input
              className="auth-modal__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              required
            />
          </label>

          {message ? <p className="auth-modal__error">{message}</p> : null}

          <button className="auth-modal__submit" disabled={loading} type="submit">
            {loading ? "提交中…" : mode === "sign-in" ? "登录" : "注册并登录"}
          </button>
        </form>

        <p className="auth-modal__switch">
          {mode === "sign-in" ? "还没有账号？" : "已有账号？"}
          <button
            type="button"
            className="auth-modal__switch-btn"
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setMessage("");
            }}
          >
            {mode === "sign-in" ? "去注册" : "去登录"}
          </button>
        </p>
      </div>
    </div>
  );
}
