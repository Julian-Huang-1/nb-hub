import type { IsoDateString } from "./common.js";

export type ConfusionStatus = "open" | "resolved" | string;

export type ConfusionDto = {
  id: number;
  sessionId: number | null;
  sourceMessageId: number | null;
  title: string;
  description: string;
  status: ConfusionStatus;
  tagsJson: string;
  createdAt: IsoDateString;
  resolvedAt: IsoDateString | null;
};

export type ConfusionResolutionDto = {
  id: number;
  confusionId: number;
  resolvedByMessageId: number | null;
  resolutionMd: string;
  confidence: number;
  createdAt: IsoDateString;
};

export type ListConfusionsQuery = {
  status?: string;
};

export type ResolveConfusionBody = {
  answer: string;
  question?: string;
  resolvedByMessageId?: number;
};

/** `POST /confusions/:id/resolve` */
export type ResolveConfusionResponseData = {
  confusion: ConfusionDto | undefined;
  resolution: ConfusionResolutionDto;
};

/** `GET /confusions` */
export type ListConfusionsResponseData = ConfusionDto[];

/** `GET /confusions/:id/resolutions` */
export type ListConfusionResolutionsResponseData = ConfusionResolutionDto[];
