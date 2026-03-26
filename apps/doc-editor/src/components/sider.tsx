import { useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SiderProps = HTMLAttributes<HTMLElement> & {
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
};

export function Sider({
  className,
  collapsible = true,
  defaultCollapsed = false,
  collapsed,
  onCollapsedChange,
  children,
  ...props
}: SiderProps) {
  const [innerCollapsed, setInnerCollapsed] = useState(defaultCollapsed);
  const isControlled = collapsed !== undefined;
  const isCollapsed = isControlled ? collapsed : innerCollapsed;

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    if (!isControlled) {
      setInnerCollapsed(next);
    }
    onCollapsedChange?.(next);
  };

  return (
    <aside
      data-collapsed={isCollapsed ? "true" : "false"}
      className={cn(
        "fixed left-0 top-0 z-40 h-screen min-h-screen border-r bg-card text-card-foreground transition-all",
        isCollapsed ? "w-14 p-2" : "w-64 p-3",
        className,
      )}
      {...props}
    >
      {collapsible ? (
        <button
          type="button"
          aria-label={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
          className="absolute right-2 top-2 h-7 w-7 rounded-md border text-xs hover:bg-accent hover:text-accent-foreground"
          onClick={toggleCollapsed}
        >
          {isCollapsed ? ">" : "<"}
        </button>
      ) : null}
      <div className={cn(isCollapsed ? "mt-10 hidden" : "mt-6")}>{children}</div>
    </aside>
  );
}

type SiderHeaderProps = HTMLAttributes<HTMLDivElement>;

export function SiderHeader({ className, ...props }: SiderHeaderProps) {
  return <div className={cn("mb-2 text-sm font-medium", className)} {...props} />;
}

type SiderContentProps = HTMLAttributes<HTMLDivElement>;

export function SiderContent({ className, ...props }: SiderContentProps) {
  return <div className={cn("space-y-2 overflow-y-auto pr-1", className)} {...props} />;
}

type SiderItemButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  title: ReactNode;
  description?: ReactNode;
  active?: boolean;
};

export function SiderItemButton({
  title,
  description,
  active = false,
  className,
  ...props
}: SiderItemButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded-md border px-2 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground",
        active ? "border-primary/60 bg-primary/10" : "border-border",
        className,
      )}
      {...props}
    >
      <div className="truncate text-sm font-medium">{title}</div>
      {description ? <div className="mt-1 text-xs text-muted-foreground">{description}</div> : null}
    </button>
  );
}
