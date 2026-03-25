import type { ChatPanel } from "@mariozechner/pi-web-ui";

/**
 * 初始化 Pi ChatPanel（IndexedDB + Agent + 默认 OpenAI 模型）。
 * 需在界面挂载时调用；用户通过 Pi 内置流程配置 API Key。
 */
export async function setupChatPanel(
  container: HTMLElement,
): Promise<ChatPanel> {
  await import("@mariozechner/pi-web-ui/app.css");

  const [
    {
      ChatPanel: Panel,
      AppStorage,
      IndexedDBStorageBackend,
      ProviderKeysStore,
      SessionsStore,
      SettingsStore,
      CustomProvidersStore,
      setAppStorage,
      defaultConvertToLlm,
      ApiKeyPromptDialog,
    },
    { Agent },
    { getModel },
  ] = await Promise.all([
    import("@mariozechner/pi-web-ui"),
    import("@mariozechner/pi-agent-core"),
    import("@mariozechner/pi-ai"),
  ]);

  const settings = new SettingsStore();
  const providerKeys = new ProviderKeysStore();
  const sessions = new SessionsStore();
  const customProviders = new CustomProvidersStore();

  const backend = new IndexedDBStorageBackend({
    dbName: "mind-box-pi",
    version: 1,
    stores: [
      settings.getConfig(),
      providerKeys.getConfig(),
      sessions.getConfig(),
      SessionsStore.getMetadataConfig(),
      customProviders.getConfig(),
    ],
  });

  settings.setBackend(backend);
  providerKeys.setBackend(backend);
  sessions.setBackend(backend);
  customProviders.setBackend(backend);

  const storage = new AppStorage(
    settings,
    providerKeys,
    sessions,
    customProviders,
    backend,
  );
  setAppStorage(storage);

  const agent = new Agent({
    initialState: {
      systemPrompt: "You are a helpful assistant for Mind-box.",
      model: getModel("openai", "gpt-4o-mini"),
      thinkingLevel: "off",
      messages: [],
      tools: [],
    },
    convertToLlm: defaultConvertToLlm,
  });

  const chatPanel = new Panel();
  await chatPanel.setAgent(agent, {
    onApiKeyRequired: async (provider) =>
      ApiKeyPromptDialog.prompt(provider),
  });

  chatPanel.style.cssText =
    "display:block;width:100%;height:100%;min-height:70vh;";

  container.appendChild(chatPanel);
  return chatPanel;
}

export function teardownChatPanel(
  chatPanel: ChatPanel | undefined,
  container: HTMLElement | null,
): void {
  if (chatPanel) {
    chatPanel.remove();
    return;
  }
  if (container) {
    container.replaceChildren();
  }
}
