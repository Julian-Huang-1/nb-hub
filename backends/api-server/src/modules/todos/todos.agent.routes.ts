/**
 * Todos Agent API 路由
 * 提供与 AI Agent 交互的 HTTP 接口
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { todosAgent } from "./todos.agent.js";

const router = Router();

const requireUserId = (req: { auth?: { userId?: string } }) => {
  const userId = req.auth?.userId;
  if (!userId) throw new Error("unauthorized");
  return userId;
};

/**
 * POST /todos/agent/chat
 * 非流式聊天接口
 */
router.post("/agent/chat", async (req: Request, res: Response) => {
  try {
    const { prompt, sessionId } = req.body;
    const userId = requireUserId(req);

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({
        status: "error",
        message: "prompt is required",
      });
      return;
    }

    const agent = await todosAgent.create(userId, sessionId);
    const result = await agent.prompt(prompt);

    if (!result.success) {
      res.status(500).json({
        status: "error",
        message: result.error || "Agent execution failed",
      });
      return;
    }

    // 提取响应文本
    let responseText = "";
    const message = result.message;
    if (message.role === "assistant" && typeof message.content === "string") {
      responseText = message.content;
    }

    res.json({
      status: "ok",
      data: {
        response: responseText,
        messages: result.allMessages,
        sessionId: sessionId || `session-${Date.now()}`,
      },
    });
  } catch (error) {
    console.error("Todos Agent chat error:", error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(message === "unauthorized" ? 401 : 500).json({
      status: "error",
      message,
    });
  }
});

/**
 * POST /todos/agent/chat/stream
 * 流式聊天接口 (SSE)
 */
router.post("/agent/chat/stream", async (req: Request, res: Response) => {
  try {
    const { prompt, sessionId } = req.body;
    const userId = requireUserId(req);

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({
        status: "error",
        message: "prompt is required",
      });
      return;
    }

    // 设置 SSE 头
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const { createStreamingAgent, getDefaultModel } = await import("../agent/index.js");
    const model = await getDefaultModel();

    // 创建流式 agent
    const agent = await createStreamingAgent(
      {
        systemPrompt: `你是一个智能待办事项管理助手。`,
        model,
        thinkingLevel: "low",
        sessionId,
      },
      {
        userId,
        requestId: `todos-stream-${Date.now()}`,
      },
      async (event) => {
        // 发送事件到客户端
        res.write(`data: ${JSON.stringify(event)}\n\n`);

        // 如果 agent 结束，关闭连接
        if (event.type === "agent_end") {
          res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
          res.end();
        }
      }
    );

    // 执行提示词
    await agent.prompt(prompt);
  } catch (error) {
    console.error("Todos Agent stream error:", error);
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = message === "unauthorized" ? 401 : 500;
    
    if (!res.headersSent) {
      res.status(statusCode).json({
        status: "error",
        message,
      });
    } else {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error: message,
        })}\n\n`
      );
      res.end();
    }
  }
});

/**
 * POST /todos/agent/quick
 * 快速问答接口（无状态）
 */
router.post("/agent/quick", async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    const userId = requireUserId(req);

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({
        status: "error",
        message: "prompt is required",
      });
      return;
    }

    const response = await todosAgent.quickAsk(userId, prompt);

    res.json({
      status: "ok",
      data: { response },
    });
  } catch (error) {
    console.error("Todos Agent quick ask error:", error);
    const message = error instanceof Error ? error.message : String(error);
    res.status(message === "unauthorized" ? 401 : 500).json({
      status: "error",
      message,
    });
  }
});

export { router as todosAgentRouter };
