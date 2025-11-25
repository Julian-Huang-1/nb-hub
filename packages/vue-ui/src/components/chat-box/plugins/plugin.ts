import type { MessagePlugin, MessagePluginnUiContext } from "./types";

export class messagePluginManner {
  static plugins: MessagePlugin[] = [];
  private plugin: MessagePlugin | null = null;

  // 注册插件
  async use(plugin: MessagePlugin): Promise<void> {
    this.plugin = plugin;
    messagePluginManner.plugins.push(this.plugin);
  }
  // 单插件发送模式
  async sendMessage(uiContext: MessagePluginnUiContext) {
    if (this.plugin?.sendMessage) {
      try {
        await this.plugin.sendMessage(uiContext);
      } catch (e) {
        console.error(
          `[messagePluginManner] Error sending message to plugin ${this.plugin.name}:${e}`
        );
      }
    }
  }

  async abort() {
    if (this.plugin?.abort) {
      this.plugin.abort();
    }
  }
}
