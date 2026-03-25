import type { ResolveConfusionBody } from "@nb-hub/contracts";
import { aiOrchestrator } from "../ai/ai-orchestrator.js";
import { confusionsRepository } from "./confusions.repository.js";

export const confusionsService = {
  list(status?: unknown) {
    const normalized = typeof status === "string" && status.trim() ? status.trim() : undefined;
    return confusionsRepository.listConfusions(normalized);
  },

  markResolved(
    confusionId: number,
    body: ResolveConfusionBody | Record<string, unknown>,
  ) {
    const confusion = confusionsRepository.findConfusionById(confusionId);
    if (!confusion) throw new Error("confusion not found");
    if (typeof body.answer !== "string" || body.answer.trim().length === 0) {
      throw new Error("answer is required");
    }

    const question =
      typeof body.question === "string" && body.question.trim()
        ? body.question.trim()
        : confusion.description;
    const answer = body.answer.trim();
    const resolvedByMessageId =
      typeof body.resolvedByMessageId === "number" ? body.resolvedByMessageId : undefined;

    const resolutionMd = aiOrchestrator.buildResolutionMarkdown({ question, answer });
    const updatedConfusion = confusionsRepository.updateConfusionResolved(confusionId);
    const resolution = confusionsRepository.createResolution({
      confusionId,
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
