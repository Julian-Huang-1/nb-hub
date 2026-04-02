# shadcn MCP 服务

CLI 内置了一个 MCP 服务，允许 AI 助手在组件仓库中进行搜索、浏览、查看和安装。

---

## 设置

```bash
shadcn mcp        # 启动 MCP 服务（stdio）
shadcn mcp init   # 写入编辑器配置
```

编辑器配置文件位置：

| 编辑器 | 配置文件 |
|--------|----------|
| Claude Code | `.mcp.json` |
| Cursor | `.cursor/mcp.json` |
| VS Code | `.vscode/mcp.json` |
| OpenCode | `opencode.json` |
| Codex | `~/.codex/config.toml`（手动配置） |

---

## 工具

> **提示：** MCP 工具用于组件仓库相关操作（搜索、查看、安装）。项目配置（别名、框架、Tailwind 版本）请使用 `npx shadcn@latest info`，MCP 没有对应能力。

### `shadcn:get_project_registries`

从 `components.json` 返回仓库名称；若不存在 `components.json` 会报错。

**输入：** 无

### `shadcn:list_items_in_registries`

列出一个或多个仓库中的全部条目。

**输入：** `registries`（string[]）、`limit`（number，可选）、`offset`（number，可选）

### `shadcn:search_items_in_registries`

在仓库中进行模糊搜索。

**输入：** `registries`（string[]）、`query`（string）、`limit`（number，可选）、`offset`（number，可选）

### `shadcn:view_items_in_registries`

查看条目详情（含完整文件内容）。

**输入：** `items`（string[]），例如 `["@shadcn/button", "@shadcn/card"]`

### `shadcn:get_item_examples_from_registries`

查找带源码的用法示例与 demo。

**输入：** `registries`（string[]）、`query`（string），例如 `"accordion-demo"`、`"button example"`

### `shadcn:get_add_command_for_items`

返回对应的 CLI 安装命令。

**输入：** `items`（string[]），例如 `["@shadcn/button"]`

### `shadcn:get_audit_checklist`

返回组件验收检查清单（imports、依赖、lint、TypeScript）。

**输入：** 无

---

## 配置仓库

仓库配置写在 `components.json` 中。`@shadcn` 仓库始终内置可用。

```json
{
  "registries": {
    "@acme": "https://acme.com/r/{name}.json",
    "@private": {
      "url": "https://private.com/r/{name}.json",
      "headers": { "Authorization": "Bearer ${MY_TOKEN}" }
    }
  }
}
```

- 名称必须以 `@` 开头。
- URL 必须包含 `{name}`。
- `${VAR}` 会从环境变量中解析。

社区仓库索引：`https://ui.shadcn.com/r/registries.json`
