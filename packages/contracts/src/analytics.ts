import type { IsoDateString } from "./common.js";

export type ConfusionStatsDto = {
  total: number;
  open: number;
  resolved: number;
  createdThisWeek: number;
  resolvedRate: number;
};

export type SolutionDocDto = {
  id: number;
  periodKey: string;
  title: string;
  contentMd: string;
  statsJson: string;
  createdAt: IsoDateString;
};

/** `GET /analytics/confusions` */
export type GetConfusionStatsResponseData = ConfusionStatsDto;

/** `GET /analytics/solution-docs` */
export type ListSolutionDocsResponseData = SolutionDocDto[];

/** `POST /analytics/solution-docs/weekly` */
export type GenerateWeeklySolutionDocResponseData = SolutionDocDto;
