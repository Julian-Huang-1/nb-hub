import { Link, Outlet, useLocation } from "react-router";
import { ScrollBehavior } from "../components/ScrollBehavior";
import { site } from "../site";
import { Button } from "@/components/ui/button";

export default function BlogLayout() {
  const location = useLocation();
  const navPostsActive =
    (location.pathname === "/" && location.hash !== "#about") ||
    location.pathname.startsWith("/posts/");
  const navAboutActive =
    location.pathname === "/" && location.hash === "#about";
  const navAnkiActive = location.pathname === "/anki";
  const navTodoActive = location.pathname === "/todolist";

  return (
    <div className="mx-auto flex min-h-svh max-w-3xl flex-col px-5 pb-12">
      <ScrollBehavior />
      <header className="flex flex-col gap-4 border-b border-border py-8 sm:flex-row sm:items-end sm:justify-between">
        <Link
          to="/#posts"
          className="flex flex-col gap-1 text-left no-underline"
        >
          <span className="text-lg font-semibold tracking-tight text-foreground">
            {site.title}
          </span>
          <span className="max-w-sm text-sm text-muted-foreground">
            {site.tagline}
          </span>
        </Link>
        <nav className="flex flex-wrap gap-1" aria-label="主导航">
          <Button
            variant={navPostsActive ? "secondary" : "ghost"}
            size="sm"
            asChild
          >
            <Link to="/#posts">文章</Link>
          </Button>
          <Button
            variant={navAboutActive ? "secondary" : "ghost"}
            size="sm"
            asChild
          >
            <Link to="/#about">关于</Link>
          </Button>
          <Button
            variant={navAnkiActive ? "secondary" : "ghost"}
            size="sm"
            asChild
          >
            <Link to="/anki">记忆卡</Link>
          </Button>
          <Button
            variant={navTodoActive ? "secondary" : "ghost"}
            size="sm"
            asChild
          >
            <Link to="/todolist">待办</Link>
          </Button>
        </nav>
      </header>

      <Outlet />

      <footer className="mt-auto border-t border-border pt-6">
        <p className="text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} {site.title} · 以文字对抗遗忘~
        </p>
      </footer>
    </div>
  );
}
