type EventHandler<T = any> = (data: T) => void;

export class EventBus {
  private listeners = new Map<string, Set<EventHandler>>();

  on<T = any>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)!.add(handler);

    // 返回取消订阅函数
    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  emit<T = any>(event: ChatEventType, data?: T): void {
    this.listeners.get(event)?.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }

  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// 事件类型定义
export const ChatEvent = {
  SESSION_CREATED: "session:created",
  SESSION_UPDATED: "session:updated",
  SESSION_DELETED: "session:deleted",
  MESSAGE_SENT: "message:sent",
  MESSAGE_STREAMING: "message:streaming",
  MESSAGE_COMPLETED: "message:completed",
  MESSAGE_ERROR: "message:error",
} as const;

export type ChatEventType = (typeof ChatEvent)[keyof typeof ChatEvent];
