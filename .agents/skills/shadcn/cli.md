# shadcn CLI 参考

配置读取自 `components.json`。

> **重要：** 始终使用项目对应的包管理执行器：`npx shadcn@latest`、`pnpm dlx shadcn@latest` 或 `bunx --bun shadcn@latest`。请依据项目上下文的 `packageManager` 选择。下文示例默认写 `npx shadcn@latest`，实际使用请替换为你的项目执行器。

> **重要：** 只使用本文档列出的参数。不要猜测或虚构 flag；未列出的 flag 就不存在。CLI 会根据锁文件自动识别包管理器，不存在 `--package-manager` 参数。

## 目录

- 命令：init、add（dry-run、智能合并）、search、view、docs、info、build
- 模板：next、vite、start、react-router、astro
- Preset：命名、代码、URL 三种格式
- 切换 preset

---

## 命令

### `init` - 初始化或创建项目

```bash
npx shadcn@latest init [components...] [options]
```

在已有项目中初始化 shadcn/ui，或在传入 `--name` 时创建新项目。可在同一步骤安装组件。

| Flag                    | Short | Description                                               | Default |
| ----------------------- | ----- | --------------------------------------------------------- | ------- |
| `--template <template>` | `-t`  | Template (next, start, vite, next-monorepo, react-router) | —       |
| `--preset [name]`       | `-p`  | Preset configuration (named, code, or URL)                | —       |
| `--yes`                 | `-y`  | Skip confirmation prompt                                  | `true`  |
| `--defaults`            | `-d`  | Use defaults (`--template=next --preset=base-nova`)       | `false` |
| `--force`               | `-f`  | Force overwrite existing configuration                    | `false` |
| `--cwd <cwd>`           | `-c`  | Working directory                                         | current |
| `--name <name>`         | `-n`  | Name for new project                                      | —       |
| `--silent`              | `-s`  | Mute output                                               | `false` |
| `--rtl`                 |       | Enable RTL support                                        | —       |
| `--reinstall`           |       | Re-install existing UI components                         | `false` |
| `--monorepo`            |       | Scaffold a monorepo project                               | —       |
| `--no-monorepo`         |       | Skip the monorepo prompt                                  | —       |

`npx shadcn@latest create` is an alias for `npx shadcn@latest init`.

### `add` - 添加组件

> **重要：** 当你要对比本地组件与上游版本，或预览变更时，务必使用 `npx shadcn@latest add <component> --dry-run`、`--diff` 或 `--view`。不要手动从 GitHub 等来源抓原始文件；CLI 会自动处理仓库解析、文件路径与 CSS diff。

```bash
npx shadcn@latest add [components...] [options]
```

Accepts component names, registry-prefixed names (`@magicui/shimmer-button`), URLs, or local paths.

| Flag            | Short | Description                                                                                                          | Default |
| --------------- | ----- | -------------------------------------------------------------------------------------------------------------------- | ------- |
| `--yes`         | `-y`  | Skip confirmation prompt                                                                                             | `false` |
| `--overwrite`   | `-o`  | Overwrite existing files                                                                                             | `false` |
| `--cwd <cwd>`   | `-c`  | Working directory                                                                                                    | current |
| `--all`         | `-a`  | Add all available components                                                                                         | `false` |
| `--path <path>` | `-p`  | Target path for the component                                                                                        | —       |
| `--silent`      | `-s`  | Mute output                                                                                                          | `false` |
| `--dry-run`     |       | Preview all changes without writing files                                                                            | `false` |
| `--diff [path]` |       | Show diffs. Without a path, shows the first 5 files. With a path, shows that file only (implies `--dry-run`)         | —       |
| `--view [path]` |       | Show file contents. Without a path, shows the first 5 files. With a path, shows that file only (implies `--dry-run`) | —       |

#### Dry-Run 模式

`--dry-run` 用于预览 `add` 将执行的改动，不会真正写入文件。`--diff` 与 `--view` 都隐含 `--dry-run`。

```bash
# 预览全部变更
npx shadcn@latest add button --dry-run

# 查看全部文件 diff（前 5 个）
npx shadcn@latest add button --diff

# 查看指定文件 diff
npx shadcn@latest add button --diff button.tsx

# 查看全部文件内容（前 5 个）
npx shadcn@latest add button --view

# 查看指定文件完整内容
npx shadcn@latest add button --view button.tsx

# 也支持 URL
npx shadcn@latest add https://api.npoint.io/abc123 --dry-run

# CSS diff
npx shadcn@latest add button --diff globals.css
```

**何时使用 dry-run：**

- 用户问“会新增哪些文件”或“会改什么”时，用 `--dry-run`。  
- 覆盖已有组件前，先用 `--diff` 预览。  
- 仅想查看源码不安装时，用 `--view`。  
- 想看 `globals.css` 会怎样变化时，用 `--diff globals.css`。  
- 安装前审查第三方仓库代码时，用 `--view`。

> **`add --dry-run` 与 `view` 的区别：** 如果用户要预览“项目内实际变更”，优先 `npx shadcn@latest add --dry-run/--diff/--view`。`npx shadcn@latest view` 只显示仓库原始元信息；而 `add --dry-run` 会给出项目中的真实落地结果（解析后的路径、与现有文件的 diff、CSS 变更）。

#### 从上游做智能合并

完整流程见 [SKILL.md 的 Updating Components](./SKILL.md#updating-components)。

### `search` - 搜索仓库

```bash
npx shadcn@latest search <registries...> [options]
```

跨仓库模糊搜索。该命令也可写作 `npx shadcn@latest list`。不传 `-q` 时会列出全部条目。

| Flag                | Short | Description            | Default |
| ------------------- | ----- | ---------------------- | ------- |
| `--query <query>`   | `-q`  | Search query           | —       |
| `--limit <number>`  | `-l`  | Max items per registry | `100`   |
| `--offset <number>` | `-o`  | Items to skip          | `0`     |
| `--cwd <cwd>`       | `-c`  | Working directory      | current |

### `view` - 查看条目详情

```bash
npx shadcn@latest view <items...> [options]
```

显示条目信息（包括文件内容）。示例：`npx shadcn@latest view @shadcn/button`。

### `docs` - 获取组件文档 URL

```bash
npx shadcn@latest docs <components...> [options]
```

输出组件文档、示例和 API 参考的解析后 URL。支持一个或多个组件名；需再访问这些 URL 获取实际内容。

Example output for `npx shadcn@latest docs input button`:

```
base  radix

input
  docs      https://ui.shadcn.com/docs/components/radix/input
  examples  https://raw.githubusercontent.com/.../examples/input-example.tsx

button
  docs      https://ui.shadcn.com/docs/components/radix/button
  examples  https://raw.githubusercontent.com/.../examples/button-example.tsx
```

Some components include an `api` link to the underlying library (e.g. `cmdk` for the command component).

### `diff` - 检查更新

不要使用该命令。请改用 `npx shadcn@latest add --diff`。

### `info` - 项目信息

```bash
npx shadcn@latest info [options]
```

显示项目信息和 `components.json` 配置。建议优先执行，用于确认框架、别名、Tailwind 版本和解析路径。

| Flag          | Short | Description       | Default |
| ------------- | ----- | ----------------- | ------- |
| `--cwd <cwd>` | `-c`  | Working directory | current |

**Project Info fields:**

| Field                | Type      | Meaning                                                            |
| -------------------- | --------- | ------------------------------------------------------------------ |
| `framework`          | `string`  | Detected framework (`next`, `vite`, `react-router`, `start`, etc.) |
| `frameworkVersion`   | `string`  | Framework version (e.g. `15.2.4`)                                  |
| `isSrcDir`           | `boolean` | Whether the project uses a `src/` directory                        |
| `isRSC`              | `boolean` | Whether React Server Components are enabled                        |
| `isTsx`              | `boolean` | Whether the project uses TypeScript                                |
| `tailwindVersion`    | `string`  | `"v3"` or `"v4"`                                                   |
| `tailwindConfigFile` | `string`  | Path to the Tailwind config file                                   |
| `tailwindCssFile`    | `string`  | Path to the global CSS file                                        |
| `aliasPrefix`        | `string`  | Import alias prefix (e.g. `@`, `~`, `@/`)                          |
| `packageManager`     | `string`  | Detected package manager (`npm`, `pnpm`, `yarn`, `bun`)            |

**Components.json fields:**

| Field                | Type      | Meaning                                                                                    |
| -------------------- | --------- | ------------------------------------------------------------------------------------------ |
| `base`               | `string`  | Primitive library (`radix` or `base`) — determines component APIs and available props      |
| `style`              | `string`  | Visual style (e.g. `nova`, `vega`)                                                         |
| `rsc`                | `boolean` | RSC flag from config                                                                       |
| `tsx`                | `boolean` | TypeScript flag                                                                            |
| `tailwind.config`    | `string`  | Tailwind config path                                                                       |
| `tailwind.css`       | `string`  | Global CSS path — this is where custom CSS variables go                                    |
| `iconLibrary`        | `string`  | Icon library — determines icon import package (e.g. `lucide-react`, `@tabler/icons-react`) |
| `aliases.components` | `string`  | Component import alias (e.g. `@/components`)                                               |
| `aliases.utils`      | `string`  | Utils import alias (e.g. `@/lib/utils`)                                                    |
| `aliases.ui`         | `string`  | UI component alias (e.g. `@/components/ui`)                                                |
| `aliases.lib`        | `string`  | Lib alias (e.g. `@/lib`)                                                                   |
| `aliases.hooks`      | `string`  | Hooks alias (e.g. `@/hooks`)                                                               |
| `resolvedPaths`      | `object`  | Absolute file-system paths for each alias                                                  |
| `registries`         | `object`  | Configured custom registries                                                               |

**Links fields:**

The `info` output includes a **Links** section with templated URLs for component docs, source, and examples. For resolved URLs, use `npx shadcn@latest docs <component>` instead.

### `build` - 构建自定义仓库

```bash
npx shadcn@latest build [registry] [options]
```

将 `registry.json` 构建为可分发的多个 JSON 文件。默认输入 `./registry.json`，默认输出 `./public/r`。

| Flag              | Short | Description       | Default      |
| ----------------- | ----- | ----------------- | ------------ |
| `--output <path>` | `-o`  | Output directory  | `./public/r` |
| `--cwd <cwd>`     | `-c`  | Working directory | current      |

---

## 模板（Templates）

| Value          | Framework      | Monorepo support |
| -------------- | -------------- | ---------------- |
| `next`         | Next.js        | Yes              |
| `vite`         | Vite           | Yes              |
| `start`        | TanStack Start | Yes              |
| `react-router` | React Router   | Yes              |
| `astro`        | Astro          | Yes              |
| `laravel`      | Laravel        | No               |

所有模板都支持通过 `--monorepo` 脚手架单仓多包。传入后会使用 monorepo 专用模板目录（如 `next-monorepo`、`vite-monorepo`）。若未传 `--monorepo` 或 `--no-monorepo`，CLI 会交互询问。Laravel 不支持 monorepo 脚手架。

---

## Preset

通过 `--preset` 指定 preset 有三种方式：

1. **命名**：`--preset base-nova` 或 `--preset radix-nova`  
2. **代码**：`--preset a2r6bw`（base62 字符串，小写 `a` 开头）  
3. **URL**：`--preset "https://ui.shadcn.com/init?base=radix&style=nova&..."`

> **重要：** 不要手动解码、抓取或解析 preset code。它是黑盒标识，直接传给 `npx shadcn@latest init --preset <code>` 即可。

## 切换 Preset

先询问用户对现有组件的策略：**reinstall**、**merge** 还是 **skip**？

- **Re-install** → `npx shadcn@latest init --preset <code> --force --reinstall`. Overwrites all component files with the new preset styles. Use when the user hasn't customized components.
- **Merge** → `npx shadcn@latest init --preset <code> --force --no-reinstall`, then run `npx shadcn@latest info` to get the list of installed components and use the [smart merge workflow](./SKILL.md#updating-components) to update them one by one, preserving local changes. Use when the user has customized components.
- **Skip** → `npx shadcn@latest init --preset <code> --force --no-reinstall`. Only updates config and CSS variables, leaves existing components as-is.

Always run preset commands inside the user's project directory. The CLI automatically preserves the current base (`base` vs `radix`) from `components.json`. If you must use a scratch/temp directory (e.g. for `--dry-run` comparisons), pass `--base <current-base>` explicitly — preset codes do not encode the base.
