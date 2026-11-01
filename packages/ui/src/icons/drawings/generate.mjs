// 根据 drawings.mjs 生成 ../glyphs.ts 和 ../index.ts。
//   pnpm --filter @nb-hub/ui icons                    生成两个文件
//   pnpm --filter @nb-hub/ui icons --check            任一生成文件过期时以状态码 1 退出
//   pnpm --filter @nb-hub/ui icons --preview [Name…]  生成图标对照预览页并输出路径

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ALIASES, DRAWINGS } from "./drawings.mjs";

const ROLES = { b: "icon-body", k: "icon-cut" };
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

function nodes(name, markup) {
  const list = [];
  for (const m of markup.matchAll(/<(\w+)([^>]*?)\/>/g)) {
    const attrs = {};
    for (const a of m[2].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    const role = ROLES[attrs.class];
    delete attrs.class;
    if (role) attrs.className = role === "icon-cut" && attrs.fill === "currentColor" ? "icon-cut-fill" : role;
    const clean = {};
    for (const [k, v] of Object.entries(attrs)) clean[k === "className" ? k : camel(k)] = v.replace(/\s+/g, " ").trim();
    list.push([m[1], clean]);
  }
  if (!list.length) throw new Error(`${name}: empty drawing`);
  return list;
}

export function renderGlyphs() {
  return [
    'import type { IconNode } from "./create-icon";',
    "",
    "// 由 drawings/generate.mjs 根据 drawings/drawings.mjs 自动生成，请勿手动修改。",
    "// `icon-body` 标记主体轮廓，使用方可为其添加浅色填充；",
    "// `icon-cut` / `icon-cut-fill` 分别标记主体内部的描边和实心细节。",
    "",
    ...Object.keys(DRAWINGS)
      .sort()
      .map((n) => `export const ${n}: IconNode = ${JSON.stringify(nodes(n, DRAWINGS[n]))};`),
    "",
  ].join("\n");
}

export function exportNames() {
  const canonical = Object.fromEntries(Object.keys(DRAWINGS).map((n) => [n, n]));
  for (const [n, aliases] of Object.entries(ALIASES)) {
    if (!DRAWINGS[n]) throw new Error(`alias target ${n} has no drawing`);
    for (const a of aliases) {
      if (canonical[a]) throw new Error(`${a} is both a drawing and an alias`);
      canonical[a] = n;
    }
  }
  return canonical;
}

export function renderIndex() {
  const canonical = exportNames();
  return [
    'import { createIcon } from "./create-icon";',
    'import * as glyph from "./glyphs";',
    "",
    "// 由 drawings/generate.mjs 自动生成，请勿手动修改。",
    "// 产品使用 nb-hub 自绘图标；新增图形请修改 drawings/drawings.mjs。",
    "",
    'export { ICON_STROKE_WIDTH, type IconComponent, type IconNode, type IconProps } from "./create-icon";',
    "",
    ...Object.keys(canonical)
      .sort()
      .map((n) => `export const ${n} = /* @__PURE__ */ createIcon("${n}", glyph.${canonical[n]});`),
    "",
  ].join("\n");
}

export const OUTPUTS = {
  "glyphs.ts": renderGlyphs,
  "index.ts": renderIndex,
};

/** 按 `names`（默认全部）生成 48、18、14px 图标和选中着色效果的对照预览页。 */
export function renderPreview(names = Object.keys(DRAWINGS)) {
  const svg = (body, px) =>
    `<svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  const tiles = names.map((n) => {
    if (!DRAWINGS[n]) throw new Error(`no drawing named ${n}`);
    const tinted = DRAWINGS[n].replace(/class="b"/g, 'class="b" fill="currentColor" fill-opacity=".2"');
    return `<figure>${svg(DRAWINGS[n], 48)}<div>${svg(DRAWINGS[n], 18)}${svg(DRAWINGS[n], 14)}<b>${svg(tinted, 18)}</b></div><figcaption>${n}</figcaption></figure>`;
  });
  return `<!doctype html><meta charset="utf-8"><style>
body{margin:0;padding:20px;font:11px system-ui;color:#27272a;display:grid;grid-template-columns:repeat(auto-fill,110px);gap:8px}
figure{margin:0;border:1px solid #e4e4e7;border-radius:10px;padding:10px 4px 6px;display:flex;flex-direction:column;align-items:center;gap:6px}
div{display:flex;gap:8px;align-items:center}b{display:flex;padding:2px;border-radius:5px;background:#ececef;color:#09090b}
figcaption{color:#71717a;max-width:100%;overflow:hidden;text-overflow:ellipsis}
</style>${tiles.join("")}`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const preview = process.argv.indexOf("--preview");
  if (preview !== -1) {
    const names = process.argv.slice(preview + 1);
    const file = join(tmpdir(), "nb-hub-icons-preview.html");
    writeFileSync(file, renderPreview(names.length ? names : undefined));
    console.log(file);
    process.exit(0);
  }
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const [file, render] of Object.entries(OUTPUTS)) {
    const url = new URL(`../${file}`, import.meta.url);
    const next = render();
    if (existsSync(url) && readFileSync(url, "utf8") === next) continue;
    stale++;
    if (check) console.error(`icons/${file} is out of date; run pnpm --filter @nb-hub/ui icons`);
    else writeFileSync(url, next);
  }
  if (check && stale) process.exit(1);
  console.log(`${Object.keys(DRAWINGS).length} drawings, ${Object.keys(exportNames()).length} names`);
}
