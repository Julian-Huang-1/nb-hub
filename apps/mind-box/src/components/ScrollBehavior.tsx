import { useLayoutEffect } from "react";
import { useLocation } from "react-router";

/** 对齐原 vue-router scrollBehavior（首页 #about / #posts 一律滚到顶部等） */
export function ScrollBehavior() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  useLayoutEffect(() => {
    if (isHome && (location.hash === "#about" || location.hash === "#posts")) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (location.hash) {
      document.querySelector(location.hash)?.scrollIntoView({
        behavior: "smooth",
      });
      return;
    }
    window.scrollTo({ top: 0 });
  }, [isHome, location.pathname, location.hash, location.key]);

  return null;
}
