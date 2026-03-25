import type { AskBody, CreateChatSessionBody } from "@nb-hub/contracts";
import { aiOrchestrator } from "../ai/ai-orchestrator.js";
import { confusionsRepository } from "../confusions/confusions.repository.js";
import { chatRepository } from "./chat.repository.js";

export const chatService = {
  createSession(payload: CreateChatSessionBody | Record<string, unknown>) {
    const title =
      typeof payload.title === "string" && payload.title.trim()
        ? payload.title.trim()
        : "新的对话";
    return chatRepository.createSession(title);
  },

  listSessions() {
    return chatRepository.listSessions();
  },

  getSessionMessages(sessionId: number) {
    const session = chatRepository.findSessionById(sessionId);
    if (!session) throw new Error("session not found");
    return {
      session,
      messages: chatRepository.listMessagesBySessionId(sessionId),
    };
  },

  ask(sessionId: number, body: AskBody | Record<string, unknown>) {
    const session = chatRepository.findSessionById(sessionId);
    if (!session) throw new Error("session not found");
    const rawQ = "question" in body ? body.question : undefined;
    if (typeof rawQ !== "string" || rawQ.trim().length === 0) {
      throw new Error("question is required");
    }

    const question = rawQ.trim();
    const userMessage = chatRepository.createMessage({
      sessionId,
      role: "user",
      content: question,
    });

    const extracted = aiOrchestrator.extractConfusions({ question });
    const createdConfusions = extracted.map((item) =>
      confusionsRepository.createConfusion({
        sessionId,
        sourceMessageId: userMessage.id,
        title: item.title,
        description: item.description,
        tags: item.tags,
      }),
    );

    const answer = aiOrchestrator.buildAssistantReply({ question });
    const assistantMessage = chatRepository.createMessage({
      sessionId,
      role: "assistant",
      content: answer,
      metadataJson: JSON.stringify({
        extractedConfusionIds: createdConfusions.map((item) => item.id),
      }),
    });

    chatRepository.updateSessionUpdatedAt(sessionId);

    return {
      userMessage,
      assistantMessage,
      createdConfusions,
    };
  },
};
