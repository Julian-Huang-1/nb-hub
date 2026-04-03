import { useEffect, useState, type FormEvent } from "react";
import { getApiBase } from "../env";
import { authClient } from "../lib/auth-client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>{mode === "sign-in" ? "登录" : "注册"}</DialogTitle>
          <DialogDescription>
            使用与 api-server 相同的账号登录后，即可使用 Anki 等需鉴权的接口（Cookie
            将写入当前站点可访问的域）。
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={submit}>
          <FieldGroup>
            {mode === "sign-up" ? (
              <Field>
                <FieldLabel htmlFor="auth-name">昵称</FieldLabel>
                <Input
                  id="auth-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </Field>
            ) : null}
            <Field>
              <FieldLabel htmlFor="auth-email">邮箱</FieldLabel>
              <Input
                id="auth-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="auth-password">密码</FieldLabel>
              <Input
                id="auth-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                required
              />
            </Field>
          </FieldGroup>

          {message ? (
            <Alert variant="destructive">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          <Button disabled={loading} type="submit">
            {loading ? (
              <>
                <Spinner data-icon="inline-start" />
                提交中…
              </>
            ) : mode === "sign-in" ? (
              "登录"
            ) : (
              "注册并登录"
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {mode === "sign-in" ? "还没有账号？" : "已有账号？"}
          <Button
            type="button"
            variant="link"
            className="h-auto px-1 py-0"
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setMessage("");
            }}
          >
            {mode === "sign-in" ? "去注册" : "去登录"}
          </Button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
