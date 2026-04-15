import { createAgent, getDefaultModel } from "../agent/index.js";
import type { AgentMessage } from "@mariozechner/pi-agent-core";

function extractText(message: AgentMessage | null): string {
  if (!message) return "";
  if (!Array.isArray(message.content)) {
    return typeof message.content === "string" ? message.content : "";
  }
  return message.content
    .filter((c: { type: string }) => c.type === "text")
    .map((c: { type: string; text?: string }) => c.text ?? "")
    .join("")
    .trim();
}

export async function generateShellCommand(
  query: string,
  shell: string,
  cwd: string,
): Promise<string> {
  const model = await getDefaultModel();
  console.log("props", { query, shell, cwd, model });

  const agent = await createAgent(
    {
      model,
      thinkingLevel: "off",
      systemPrompt: `You are a shell command expert.
Shell: ${shell}
OS: ${process.platform === "darwin" ? "macOS" : "Linux"}
Current directory: ${cwd}

Rules:
- Return ONLY the raw shell command, nothing else
- No explanations, no markdown, no backticks, no code fences
- If multiple steps are needed, chain them with && or write a one-liner
- The command must be ready to run as-is`,
      tools: [],
    },
    { userId: "cli", requestId: `hi-${Date.now()}` },
  );

  const result = await agent.prompt(query);
  console.log("result", result);

  if (!result.success) {
    throw new Error(result.error ?? "AI failed to generate a command");
  }

  const command = extractText(result.message);
  if (!command) {
    throw new Error("AI returned an empty response");
  }

  return command;
}
