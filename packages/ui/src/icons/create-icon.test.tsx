import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Search } from "./index";

describe("自绘图标的无障碍和 DOM 属性", () => {
  it("默认隐藏装饰性图标，避免重复朗读按钮名称", () => {
    const { container } = render(<button aria-label="搜索"><Search /></button>);
    expect(screen.getByRole("button", { name: "搜索" })).toBeVisible();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("允许图标独立提供无障碍名称", () => {
    render(<Search role="img" aria-label="搜索" />);
    expect(screen.getByRole("img", { name: "搜索" })).not.toHaveAttribute("aria-hidden");
  });

  it("透传 SVG 引用、尺寸和自定义类名", () => {
    const ref = createRef<SVGSVGElement>();
    render(<Search ref={ref} size={18} className="custom-icon" />);
    expect(ref.current).toHaveAttribute("width", "18");
    expect(ref.current).toHaveAttribute("height", "18");
    expect(ref.current).toHaveClass("icon", "icon-search", "custom-icon");
  });
});
