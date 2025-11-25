export type Message = {
  id: string;
  content: string;
  timestamp: number;
};
export type Status = "idle" | "loading" | "error" | "success" | "streaming";

export interface MessagePlugin {
  name: string;
  version?: string;
  init?(config?: any): Promise<void>;
  sendMessage(uiContext: MessagePluginnUiContext): Promise<void>;
  destroy?(): Promise<void>;
  abort?(): void;
}

export interface MessagePluginnUiContext {
  messages: Message[];
  status: Status;
  setStatus(status: Status): void;
  addMessage(message: Message): void;
  updateMessage(id: string, message: Message): void;
  clearMessages(): void;
}

export interface MessagePluginnConfig {
  [key: string]: any;
}

export interface MessagePlugin {
  name: string;
  version?: string;
  init?(config?: MessagePluginnConfig): Promise<void>;
  sendMessage(options: any, context: any): Promise<void>;
  destroy?(): Promise<void>;
  abort?(): void;
}
