import type { IStorage } from "./storage.interface";

export class IndexedDBStorage implements IStorage {
  private db: IDBDatabase | null = null;
  private dbName: string;

  constructor(dbName: string = "chatbox") {
    this.dbName = dbName;
  }

  async init() {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      // 可以把它理解为数据库的"建表语句"：
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("store")) {
          db.createObjectStore("store");
        }
      };
    });
  }

  async get<T>(key: string): Promise<T | null> {
    return new Promise(async (resolve, reject) => {
      try {
        const store = await this.getStore("readonly");
        const request = store.get(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result ?? null);
      } catch (error) {
        reject(error);
      }
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const store = await this.getStore("readwrite");
        const request = store.put(value, key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async delete(key: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const store = await this.getStore("readwrite");
        const request = store.delete(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async clear(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const store = await this.getStore("readwrite");
        const request = store.clear();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  async keys(): Promise<string[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const store = await this.getStore("readonly");
        const request = store.getAllKeys();
        request.onerror = () => reject(request.error);
        request.onsuccess = () =>
          resolve(request.result.map((key) => key.toString()));
      } catch (error) {
        reject(error);
      }
    });
  }

  async getStore(type: "readonly" | "readwrite") {
    if (!this.db) {
      await this.init();
    }
    return this.db!.transaction(["store"], type).objectStore("store");
  }
}
