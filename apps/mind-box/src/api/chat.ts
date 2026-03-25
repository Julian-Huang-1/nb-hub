import type {
  AskBody,
  AskResponseData,
  ChatSessionDto,
  CreateChatSessionBody,
  CreateChatSessionResponseData,
  GetSessionMessagesResponseData,
} from "@nb-hub/contracts";
import { apiOkData } from "./http.js";

export const nbHubChatApi = {
  listSessions() {
    return apiOkData<ChatSessionDto[]>("/chat/sessions");
  },

  createSession(body: CreateChatSessionBody = {}) {
    return apiOkData<CreateChatSessionResponseData>("/chat/sessions", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  getMessages(sessionId: number) {
    return apiOkData<GetSessionMessagesResponseData>(
      `/chat/sessions/${sessionId}/messages`,
    );
  },

  ask(sessionId: number, body: AskBody) {
    return apiOkData<AskResponseData>(`/chat/sessions/${sessionId}/ask`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
