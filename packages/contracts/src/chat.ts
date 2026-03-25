import type { IsoDateString } from "./common.js";
import type { ConfusionDto } from "./confusions.js";

export type ChatSessionDto = {
  id: number;
  title: string;
  status: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
};

export type ChatMessageRole = "user" | "assistant" | string;

export type ChatMessageDto = {
  id: number;
  sessionId: number;
  role: ChatMessageRole;
  content: string;
  tokens: number | null;
  metadataJson: string | null;
  createdAt: IsoDateString;
};

export type CreateChatSessionBody = {
  title?: string;
};

export type AskBody = {
  question: string;
};

/** `POST /chat/sessions/:id/ask` */
export type AskResponseData = {
  userMessage: ChatMessageDto;
  assistantMessage: ChatMessageDto;
  createdConfusions: ConfusionDto[];
};

/** `GET /chat/sessions/:id/messages` */
export type GetSessionMessagesResponseData = {
  session: ChatSessionDto;
  messages: ChatMessageDto[];
};

/** `GET /chat/sessions` */
export type ListChatSessionsResponseData = ChatSessionDto[];

/** `POST /chat/sessions` */
export type CreateChatSessionResponseData = ChatSessionDto;
