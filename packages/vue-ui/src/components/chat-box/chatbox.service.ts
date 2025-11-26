import { OpenRouteProvider } from "../../base/ai-provider/openRouteProvider";
import { ChatBox } from "../../base/chat-box";
import { IndexedDBStorage } from "../../base/storage/indexedDB";

let chatboxInstance: ChatBox | null = null;

export function getChatBox() {
  if (!chatboxInstance) {
    chatboxInstance = new ChatBox({
      storage: new IndexedDBStorage(),
      aiProvider: new OpenRouteProvider(import.meta.env.VITE_OPENROUTER_KEY, "gpt-4o-mini"),
    });
  }
  return chatboxInstance;
}
