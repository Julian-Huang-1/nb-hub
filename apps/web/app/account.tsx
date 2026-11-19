"use client";
import { useEffect, useState } from "react";
import { createAuthClient } from "@nb-hub/core/auth";
import { AccountView } from "@nb-hub/views/account";

export function WebAccount() {
  const [client] = useState(() =>
    createAuthClient("", {
      mode: "cookie",
      readCookie: (name) => {
        const value = document.cookie.split("; ").find((item) => item.startsWith(`${name}=`));
        return value ? decodeURIComponent(value.slice(name.length + 1)) : null;
      },
      subscribeActivity: (listener) => {
        const onVisible = () => {
          if (document.visibilityState === "visible") listener();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
      },
    }),
  );
  const [error, setError] = useState<string>();
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.has("auth_error")) {
      setError("Google sign-in failed. Try again or use an email code.");
      url.searchParams.delete("auth_error");
      window.history.replaceState(null, "", url);
    }
  }, []);
  return <AccountView client={client} apiUrl="" initialError={error} />;
}
