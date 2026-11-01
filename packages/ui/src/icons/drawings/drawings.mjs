// 24×24 网格中的源图形。修改后运行 pnpm --filter @nb-hub/ui icons 重新生成。
import { dot, gear, rect, shape } from "./construction.mjs";

export const DRAWINGS = {
  Search: '<circle class="b" cx="11" cy="11" r="7.75"/><path d="m16.75 16.75 4.5 4.5"/>',
  Plus: '<path d="M12 4.5v15M4.5 12h15"/>',
  Minus: '<path d="M4.5 12h15"/>',
  Check: '<path d="m4.75 12.5 4.75 4.75 9.75-9.75"/>',
  X: '<path d="M18 6 6 18M6 6l12 12"/>',
  ChevronLeft: '<path d="m15 6-6 6 6 6"/>',
  ChevronRight: '<path d="m9 6 6 6-6 6"/>',
  ChevronDown: '<path d="m18 9-6 6-6-6"/>',
  ChevronUp: '<path d="m6 15 6-6 6 6"/>',
  ArrowLeft: '<path d="M19.5 12h-14M11 6l-6 6 6 6"/>',
  ArrowRight: '<path d="M4.5 12h14M13 6l6 6-6 6"/>',
  MoreHorizontal: dot(5, 12, 1.3) + dot(12, 12, 1.3) + dot(19, 12, 1.3),
  Settings: `<path class="b" d="${gear()}"/><circle class="k" cx="12" cy="12" r="3"/>`,
  CalendarDays: `<path class="b" d="${rect(3, 4.25, 18, 17, 7)}"/>
    <path d="M8 2.75v3M16 2.75v3"/><path class="k" d="M3 9.75h18"/>
    ${dot(9, 15)}${dot(15, 15)}`,
  Clock: '<circle class="b" cx="12" cy="12" r="9.25"/><path class="k" d="M12 7.5V12l3 2"/>',
  Inbox: `<path class="b" d="${rect(2.75, 3, 18.5, 18, 8)}"/>
    <path class="k" d="M2.75 14h4.4c.75 0 1.35.55 1.75 1.2.55.95 1.6 1.8 3.1 1.8s2.55-.85 3.1-1.8c.4-.65 1-1.2 1.75-1.2h4.4"/>`,
  CircleUser: '<circle class="b" cx="12" cy="12" r="9.25"/><circle class="k" cx="12" cy="10" r="3"/><path class="k" d="M6.6 18.4c1.3-1.85 3.2-2.8 5.4-2.8s4.1.95 5.4 2.8"/>',
  Folder: `<path class="b" d="${shape([[2.75, 3.75, 3.5], [9.25, 3.75, 1.5], [11.5, 6.25, 1.5], [21.25, 6.25, 4.5], [21.25, 20.25, 6], [2.75, 20.25, 6]])}"/>`,
  Refresh: '<path d="M20.5 12a8.5 8.5 0 1 1-2.49-6.01L19.5 7.5M19.5 3.25V7.5h-4.25"/>',
  Loader: '<circle cx="12" cy="12" r="8.75" stroke-opacity=".2"/><path d="M12 3.25A8.75 8.75 0 0 1 20.75 12"/>',
};

// 同义名称复用同一图形，避免重复绘制近似图标。
export const ALIASES = { CalendarDays: ["Calendar"], X: ["Close"], Refresh: ["RefreshCw"] };
