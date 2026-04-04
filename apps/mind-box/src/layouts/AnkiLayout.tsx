import { Link, Outlet } from "react-router";
import { ScrollBehavior } from "../components/ScrollBehavior";
import { site } from "../site";

export default function AnkiLayout() {
  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col px-5 pb-12 pt-8">
      <ScrollBehavior />
      <header className="mb-8 flex flex-col gap-2 border-b border-border pb-6">
        <Link
          to="/"
          className="w-fit text-sm text-muted-foreground no-underline hover:text-foreground"
        >
          ← {site.title}
        </Link>
        <div>
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Anki
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            记忆卡
          </h1>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
