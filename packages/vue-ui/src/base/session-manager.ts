import type { Message } from "./ai-provider/aiProvider.interface";
import { v4 as uuid } from "uuid";
import type { IStorage } from "./storage/storage.interface";
export interface Session {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface SessionMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export class SessionManager {
  private static SESSIONS_KEY = "sessions-list";
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  // 创建会话
  async create(name: string): Promise<Session> {
    const session: Session = {
      id: uuid(),
      name,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // 保存完整会话
    await this.storage.set(`session:${session.id}`, session);

    // 更新会话列表
    const sessions = await this.list();
    sessions.push(this.toMeta(session));
    await this.storage.set(SessionManager.SESSIONS_KEY, sessions);

    return session;
  }

  // 获取会话
  async get(id: string): Promise<Session | null> {
    return this.storage.get<Session>(`session:${id}`);
  }

  // 更新会话
  async update(id: string, updater: (s: Session) => Session): Promise<Session> {
    const session = await this.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    // 基于最新状态计算
    const updated = updater(session);
    updated.updatedAt = Date.now();

    await this.storage.set(`session:${id}`, updated);

    // 更新列表中的元数据
    const sessions = await this.list();
    const index = sessions.findIndex((s) => s.id === id);
    if (index !== -1) {
      sessions[index] = this.toMeta(updated);
      await this.storage.set(SessionManager.SESSIONS_KEY, sessions);
    }

    return updated;
  }

  // 删除会话
  async delete(id: string): Promise<void> {
    await this.storage.delete(`session:${id}`);

    const sessions = await this.list();
    const filtered = sessions.filter((s) => s.id !== id);
    await this.storage.set(SessionManager.SESSIONS_KEY, filtered);
  }

  // 列出所有会话
  async list(): Promise<SessionMeta[]> {
    const sessions = await this.storage.get<SessionMeta[]>(
      SessionManager.SESSIONS_KEY
    );
    return sessions || [];
  }

  private toMeta(session: Session): SessionMeta {
    return {
      id: session.id,
      name: session.name,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}
