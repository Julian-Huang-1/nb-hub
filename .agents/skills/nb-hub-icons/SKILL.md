---
name: nb-hub-icons
description: 在 nb-hub Web/桌面端新增、修改或审查自绘图标时使用，涵盖网格、圆角、描边、主体与细节标记，以及生成和预览流程。图标统一从 @nb-hub/ui/icons 导出。
---

# 绘制 nb-hub 图标

Web/桌面端图标使用项目自绘图形，统一从 `@nb-hub/ui/icons` 导出。不要引入第三方图标库、在视图中内联 SVG 或使用 emoji 替代。

## 绘制前

1. 在 `packages/ui/src/icons/index.ts` 中搜索图标名称和同义词。已有图形含义相同时，在 `drawings.mjs` 的 `ALIASES` 中添加别名，不要重复绘制。
2. 名称描述图形本身，使用现有的 PascalCase 风格，例如 `Webhook`，而非业务名称 `IntegrationsNav`。

## 文件位置

- `packages/ui/src/icons/drawings/construction.mjs`：共享几何辅助函数。
- `packages/ui/src/icons/drawings/drawings.mjs`：SVG 内部图形标记和 `ALIASES`。
- `packages/ui/src/icons/glyphs.ts`、`index.ts`：自动生成，不要手动修改；`pnpm --filter @nb-hub/ui test` 检查它们与源文件是否一致。

## 几何规则

- **网格**：使用 24×24 viewBox，渲染器提供宽度为 2、端点和连接处为圆形的描边。图形尽量位于 2.5–21.5 内，主体轮廓通常覆盖 2.75–21.25。物体图标最长边小于约 17 时，会显得比相邻图标小；尖括号、`X` 等简单符号可以保持较小。平行线间距至少为 3，确保缩至 14px 时仍有空隙。与轮廓相交的线段应恰好终止于轮廓中心线，避免圆形端点突出；缩放或移动主体后重新计算交点。
- **圆角**：使用 `shape([[x, y, k], ...])` 和 `rect(x, y, w, h, k)` 构建连续曲率圆角。大型卡片、窗口、气泡的 `k` 通常为 5–7，小部件为 2.5–4，细小拐角为 1–1.5；硬拐角用 0，但应少用。矩形不要手写 `a r r` 圆弧圆角。
- **尖角**：尖括号、箭头、命令提示符和播放三角形使用直线在顶点相交，例如 `M9 6L15 12 9 18`，或用 `head(x, y, dir, depth, half)` 绘制箭头。不要用曲线或 `k` 圆角钝化尖端，仅由描边的圆形连接柔化。转弯箭头的箭身可保留圆角。
- **勾选**：参考 `Check`，用两条直线在顶点相交；不要将转折绘成弯曲笔画，以免呈现手写感。
- **圆点**：使用 `dot(x, y, r)`，半径通常为 1.1–1.5。仅在圆点表达信息、警告、眼睛或状态灯等含义时使用。
- **多边形和星形**：使用 `polygon(cx, cy, radii, count, k)`。
- **复用**：优先复用 `rect`、`shape`、`gear`、`head`、`dot` 和已有主体图形。`…Off`、`…Plus`、`…X` 等变体在原图上增加有含义的笔画；斜杠可用 `m3 3 18 18`。

## 主体与细节

- 主闭合轮廓标记为 `class="b"`。使用方可在选中状态以 20% 不透明度填充，示例见 `packages/ui/docs/icons.md`。
- 用于导航的物体图标应有闭合主体；方向符号无需主体。不要给开放弧线标记主体，填充会使其闭合并出现多余色块。
- 主体内部的细节描边标记为 `class="k"`。
- 内部细节最多两处，每一处都应表达含义，例如勾选、符号或定义物体结构的分隔线。去掉装饰性高光、纹理和多余线段，避免在 14px 密集列表中混成噪点。

## 生成与预览

1. 将图形加入 `drawings.mjs` 的 `DRAWINGS`，按主题分组。
2. 运行 `pnpm --filter @nb-hub/ui icons --preview NewName Neighbour1 Neighbour2`，打开输出的 HTML 文件并检查：
   - 48px 下是否符合网格，与相邻图标的视觉重量是否一致。
   - 18px 和 14px 下是否仍可辨识，内部细节是否粘连。
   - 选中着色预览中是否只有主体轮廓被填充。
   - 是否能与含义相近的图标一眼区分。
3. 运行 `pnpm --filter @nb-hub/ui icons`，重新生成 `glyphs.ts` 和 `index.ts`。
4. 从 `@nb-hub/ui/icons` 导入新图标，运行 `pnpm --filter @nb-hub/ui test` 和使用方包的类型检查。
