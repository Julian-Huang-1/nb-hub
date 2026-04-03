import { useEffect } from "react";

function applyThemeDark(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
}

/** 与系统 prefers-color-scheme 同步 `.dark`，与 shadcn 主题变量一致 */
export function ThemeSync() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    applyThemeDark(mq.matches);
    const onChange = () => applyThemeDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return null;
}
