import type { IAiProvider, Message } from "./ai-provider/aiProvider.interface";
import { ChatEvent, EventBus, type ChatEventType } from "./event-bus";
import { MessageManager, type MessageCallback } from "./message-manager";
import {
  SessionManager,
  type Session,
  type SessionMeta,
} from "./session-manager";
import type { IStorage } from "./storage/storage.interface";

export interface ChatboxConfig {
  storage: IStorage;
  aiProvider: IAiProvider;
}

export class ChatBox {
  private storage: IStorage;
  private aiProvider: IAiProvider;
  private eventBus: EventBus;
  private sessionManager: SessionManager;
  private messageManager: MessageManager;

  constructor(config: ChatboxConfig) {
    this.storage = config.storage;
    this.aiProvider = config.aiProvider;

    this.eventBus = new EventBus();
    this.sessionManager = new SessionManager(this.storage);
    this.messageManager = new MessageManager(
      this.sessionManager,
      this.aiProvider
    );
    this.aiProvider = config.aiProvider;
  }

  // 设置 AI Provider
  setAIProvider(provider: IAiProvider): void {
    this.aiProvider = provider;
    this.messageManager = new MessageManager(this.sessionManager, provider);
  }

  // 会话管理
  async createSession(name: string): Promise<Session> {
    const session = await this.sessionManager.create(name);
    this.eventBus.emit(ChatEvent.SESSION_CREATED, session);
    return session;
  }

  async getSession(id: string): Promise<Session | null> {
    return this.sessionManager.get(id);
  }

  async listSessions(): Promise<SessionMeta[]> {
    return this.sessionManager.list();
  }

  async deleteSession(id: string): Promise<void> {
    await this.sessionManager.delete(id);
    this.eventBus.emit(ChatEvent.SESSION_DELETED, id);
  }

  async updateSession(
    sessionId: string,
    updater: (s: Session) => Session
  ): Promise<Session> {
    return this.sessionManager.update(sessionId, updater);
  }

  // 消息管理
  async sendMessage(
    sessionId: string,
    message: Message,
    onStream?: MessageCallback
  ): Promise<Message> {
    const wrappedCallback = (message: Message) => {
      this.eventBus.emit(ChatEvent.MESSAGE_STREAMING, { sessionId, message });
      onStream?.(message);
    };

    try {
      this.eventBus.emit(ChatEvent.MESSAGE_SENT, { sessionId, message });

      const aiMessage = await this.messageManager.send(
        sessionId,
        message,
        wrappedCallback
      );

      this.eventBus.emit(ChatEvent.MESSAGE_COMPLETED, {
        sessionId,
        message: aiMessage,
      });

      return aiMessage;
    } catch (error) {
      this.eventBus.emit(ChatEvent.MESSAGE_ERROR, { sessionId, error });
      throw error;
    }
  }
  async regenerateMessage(
    sessionId: string,
    messageId: string,
    onStream?: MessageCallback
  ): Promise<Message> {
    const wrappedCallback = (message: Parameters<MessageCallback>[0]) => {
      this.eventBus.emit(ChatEvent.MESSAGE_STREAMING, { sessionId, message });
      onStream?.(message);
    };

    return this.messageManager.regenerate(
      sessionId,
      messageId,
      wrappedCallback
    );
  }

  async deleteMessage(sessionId: string, messageId: string): Promise<void> {
    await this.messageManager.delete(sessionId, messageId);
  }

  // 事件订阅
  on(event: ChatEventType, handler: (data: any) => void): () => void {
    return this.eventBus.on(event, handler);
  }

  // 清理资源
  destroy(): void {
    this.eventBus.clear();
  }
}
