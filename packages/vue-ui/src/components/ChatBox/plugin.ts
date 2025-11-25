import type {
  ChatBoxPlugin,
  PluginConfig,
  PluginContext,
  SendMessageOptions,
} from "./types";

/**
 * 插件管理器
 * 负责管理插件的生命周期和与插件的通信
 */
export class PluginManager {
  private plugin: ChatBoxPlugin | null = null;
  private config: PluginConfig = {};
  private initialized = false;

  /**
   * 注册插件
   * @param plugin 插件实例
   * @param config 插件配置
   */
  async use(plugin: ChatBoxPlugin, config?: PluginConfig): Promise<void> {
    if (this.plugin) {
      await this.destroy();
    }

    this.plugin = plugin;
    this.config = config || {};

    if (plugin.init) {
      await plugin.init(this.config);
    }

    this.initialized = true;
    console.log(
      `[PluginManager] Plugin "${plugin.name}" registered successfully`
    );
  }

  /**
   * 发送消息
   * @param options 发送选项
   * @param context 插件上下文
   */
  async sendMessage(
    options: SendMessageOptions,
    context: PluginContext
  ): Promise<void> {
    if (!this.plugin) {
      throw new Error("No plugin registered. Please use a plugin first.");
    }

    if (!this.initialized) {
      throw new Error("Plugin not initialized");
    }

    try {
      await this.plugin.sendMessage(options, context);
    } catch (error) {
      console.error("[PluginManager] Error sending message:", error);
      throw error;
    }
  }

  /**
   * 中断当前请求
   */
  abort(): void {
    if (this.plugin?.abort) {
      this.plugin.abort();
    }
  }

  /**
   * 销毁插件
   */
  async destroy(): Promise<void> {
    if (this.plugin?.destroy) {
      await this.plugin.destroy();
    }

    this.plugin = null;
    this.initialized = false;
  }

  /**
   * 获取当前插件
   */
  getPlugin(): ChatBoxPlugin | null {
    return this.plugin;
  }

  /**
   * 检查是否有插件注册
   */
  hasPlugin(): boolean {
    return this.plugin !== null;
  }
}
