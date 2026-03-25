import { aiOrchestrator } from "../ai/ai-orchestrator.js";
import { confusionsRepository } from "./confusions.repository.js";

export const confusionsService = {
  list(status?: unknown) {
    const normalized = typeof status === "string" && status.trim() ? status.trim() : undefined;
    return confusionsRepository.listConfusions(normalized);
  },

  markResolved(payload: {
    confusionId: number;
    answer: unknown;
    question?: unknown;
    resolvedByMessageId?: unknown;
  }) {
    const confusion = confusionsRepository.findConfusionById(payload.confusionId);
    if (!confusion) throw new Error("confusion not found");
    if (typeof payload.answer !== "string" || payload.answer.trim().length === 0) {
      throw new Error("answer is required");
    }

    const question =
      typeof payload.question === "string" && payload.question.trim()
        ? payload.question.trim()
        : confusion.description;
    const answer = payload.answer.trim();
    const resolvedByMessageId =
      typeof payload.resolvedByMessageId === "number" ? payload.resolvedByMessageId : undefined;

    const resolutionMd = aiOrchestrator.buildResolutionMarkdown({ question, answer });
    const updatedConfusion = confusionsRepository.updateConfusionResolved(payload.confusionId);
    const resolution = confusionsRepository.createResolution({
      confusionId: payload.confusionId,
      resolvedByMessageId,
      resolutionMd,
      confidence: 90,
    });

    return {
      confusion: updatedConfusion,
      resolution,
    };
  },

  getResolutions(confusionId: number) {
    const confusion = confusionsRepository.findConfusionById(confusionId);
    if (!confusion) throw new Error("confusion not found");
    return confusionsRepository.listResolutionsByConfusionId(confusionId);
  },
};
