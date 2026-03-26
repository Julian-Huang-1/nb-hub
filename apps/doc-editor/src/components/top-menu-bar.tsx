import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

type TopMenuBarProps = HTMLAttributes<HTMLElement>;

export function TopMenuBar({ className, ...props }: TopMenuBarProps) {
  return (
    <header
      className={cn(
        "fixed left-0 right-0 top-0 z-30 border-b border-border bg-background/95 text-foreground backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className,
      )}
      {...props}
    >
    </header>
  );
}

type TopMenuBarInnerProps = HTMLAttributes<HTMLDivElement>;

export function TopMenuBarInner({ className, ...props }: TopMenuBarInnerProps) {
  return <div className={cn("mx-auto flex h-16 w-full items-center gap-2 px-4 sm:px-6", className)} {...props} />;
}

type TopMenuBarSectionProps = HTMLAttributes<HTMLDivElement>;

export function TopMenuBarSection({ className, ...props }: TopMenuBarSectionProps) {
  return <div className={cn("flex items-center gap-2", className)} {...props} />;
}

type TopMenuBarButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline";
};

export function TopMenuBarButton({
  className,
  variant = "outline",
  type = "button",
  ...props
}: TopMenuBarButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variant === "default"
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "border border-border bg-background hover:bg-accent hover:text-accent-foreground",
        className,
      )}
      {...props}
    />
  );
}
