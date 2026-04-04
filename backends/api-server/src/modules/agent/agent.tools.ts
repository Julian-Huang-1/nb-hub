/**
 * 通用工具定义
 * 提供跨模块可用的基础工具
 */

import { Type } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";

/**
 * 当前时间工具
 */
export const currentTimeTool: AgentTool = {
  name: "get_current_time",
  label: "获取当前时间",
  description: "获取当前系统时间和日期信息",
  parameters: Type.Object({
    format: Type.Optional(
      Type.String({
        description: "时间格式，如 'iso', 'locale', 'timestamp'",
        default: "iso",
      })
    ),
  }),
  execute: async (_toolCallId, params): Promise<AgentToolResult<{ format: string }>> => {
    const now = new Date();
    let timeString: string;

    switch (params.format) {
      case "locale":
        timeString = now.toLocaleString("zh-CN");
        break;
      case "timestamp":
        timeString = now.getTime().toString();
        break;
      case "iso":
      default:
        timeString = now.toISOString();
    }

    return {
      content: [{ type: "text", text: timeString }],
      details: { format: params.format },
    };
  },
};

/**
 * 数学计算工具
 */
export const calculatorTool: AgentTool = {
  name: "calculate",
  label: "计算器",
  description: "执行数学表达式计算，支持 +, -, *, /, **, %, 括号等",
  parameters: Type.Object({
    expression: Type.String({
      description: "数学表达式，例如 '2 + 2 * 3' 或 '(100 - 20) / 4'",
    }),
  }),
  execute: async (_toolCallId, params): Promise<AgentToolResult<{ result: number }>> => {
    try {
      // 简单的安全表达式求值
      const sanitized = params.expression.replace(/[^0-9+\-*/().\s%]/g, "");
      // eslint-disable-next-line no-eval
      const result = eval(sanitized);
      
      return {
        content: [{ type: "text", text: String(result) }],
        details: { result },
      };
    } catch (e) {
      throw new Error(`计算失败: ${e instanceof Error ? e.message : String(e)}`);
    }
  },
};

/**
 * 字符串处理工具
 */
export const stringTool: AgentTool = {
  name: "string_operations",
  label: "字符串操作",
  description: "执行字符串操作：长度、大小写转换、截取、替换等",
  parameters: Type.Object({
    operation: Type.String({
      description: "操作类型: length, uppercase, lowercase, trim, substring, replace",
    }),
    text: Type.String({ description: "输入文本" }),
    start: Type.Optional(Type.Number({ description: "substring 起始位置" })),
    end: Type.Optional(Type.Number({ description: "substring 结束位置" })),
    searchValue: Type.Optional(Type.String({ description: "replace 的搜索值" })),
    replaceValue: Type.Optional(Type.String({ description: "replace 的替换值" })),
  }),
  execute: async (_toolCallId, params): Promise<AgentToolResult<{ operation: string; result: string | number }>> => {
    const { operation, text, start, end, searchValue, replaceValue } = params;
    let result: string | number;

    switch (operation) {
      case "length":
        result = text.length;
        break;
      case "uppercase":
        result = text.toUpperCase();
        break;
      case "lowercase":
        result = text.toLowerCase();
        break;
      case "trim":
        result = text.trim();
        break;
      case "substring":
        result = text.substring(start ?? 0, end ?? text.length);
        break;
      case "replace":
        if (!searchValue) {
          throw new Error("replace 操作需要提供 searchValue");
        }
        result = text.replaceAll(searchValue, replaceValue ?? "");
        break;
      default:
        throw new Error(`不支持的操作: ${operation}`);
    }

    return {
      content: [{ type: "text", text: String(result) }],
      details: { operation, result },
    };
  },
};

/**
 * JSON 处理工具
 */
export const jsonTool: AgentTool = {
  name: "json_operations",
  label: "JSON 操作",
  description: "解析、格式化、验证 JSON",
  parameters: Type.Object({
    operation: Type.String({
      description: "操作类型: parse, stringify, format, validate",
    }),
    data: Type.String({ description: "JSON 字符串或要 stringify 的对象" }),
    pretty: Type.Optional(Type.Boolean({ description: "是否美化输出", default: true })),
  }),
  execute: async (_toolCallId, params): Promise<AgentToolResult<{ valid: boolean; operation: string }>> => {
    const { operation, data, pretty = true } = params;

    switch (operation) {
      case "parse": {
        try {
          const parsed = JSON.parse(data);
          return {
            content: [{ type: "text", text: JSON.stringify(parsed, null, pretty ? 2 : 0) }],
            details: { valid: true, operation },
          };
        } catch (e) {
          throw new Error(`JSON 解析失败: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      case "stringify": {
        try {
          // 尝试解析输入（如果是对象字符串）
          let obj: unknown;
          try {
            obj = JSON.parse(data);
          } catch {
            obj = data;
          }
          const str = JSON.stringify(obj, null, pretty ? 2 : 0);
          return {
            content: [{ type: "text", text: str }],
            details: { valid: true, operation },
          };
        } catch (e) {
          throw new Error(`JSON 序列化失败: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      case "format": {
        try {
          const parsed = JSON.parse(data);
          const formatted = JSON.stringify(parsed, null, 2);
          return {
            content: [{ type: "text", text: formatted }],
            details: { valid: true, operation },
          };
        } catch (e) {
          throw new Error(`JSON 格式化失败: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      case "validate": {
        try {
          JSON.parse(data);
          return {
            content: [{ type: "text", text: "✓ 有效的 JSON" }],
            details: { valid: true, operation },
          };
        } catch (e) {
          return {
            content: [{ type: "text", text: `✗ 无效的 JSON: ${e instanceof Error ? e.message : String(e)}` }],
            details: { valid: false, operation },
          };
        }
      }
      default:
        throw new Error(`不支持的操作: ${operation}`);
    }
  },
};

/**
 * 所有通用工具列表
 */
export const commonTools = [currentTimeTool, calculatorTool, stringTool, jsonTool];
