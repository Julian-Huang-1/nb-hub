import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { messagePluginManner } from "../plugin";
import type { MessagePlugin, MessagePluginnUiContext } from "../types";

describe("messagePluginManner", () => {
  let pluginManner: messagePluginManner;
  let mockUiContext: MessagePluginnUiContext;

  // 创建一个 mock 插件工厂函数
  const createMockPlugin = (
    overrides?: Partial<MessagePlugin>
  ): MessagePlugin => ({
    name: "TestPlugin",
    version: "1.0.0",
    sendMessage: vi.fn().mockResolvedValue(undefined),
    abort: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  beforeEach(() => {
    // 清空静态插件数组
    messagePluginManner.plugins = [];

    // 创建新的插件管理器实例
    pluginManner = new messagePluginManner();

    // 创建 mock UI 上下文
    mockUiContext = {
      messages: [],
      status: "idle",
      setStatus: vi.fn(),
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      clearMessages: vi.fn(),
    };
  });

  afterEach(() => {
    // 确保每次测试后清理
    messagePluginManner.plugins = [];
  });

  describe("use", () => {
    it("plugin实例的sendMessage方法是否被正确调用", async () => {
      const plugin = createMockPlugin({ name: "MyPlugin" });

      await pluginManner.use(plugin);
      expect(messagePluginManner.plugins).toHaveLength(1);

      // pluginManner.sendMessage 会去调 plugin.sendMessage
      await pluginManner.sendMessage(mockUiContext);
      expect(plugin.sendMessage).toHaveBeenCalledWith(mockUiContext);
    });

    it("注册多个插件，单插件发送模式使用的是最新注册的插件", async () => {
      const plugin1 = createMockPlugin({ name: "Plugin1" });
      const plugin2 = createMockPlugin({ name: "Plugin2" });

      await pluginManner.use(plugin1);
      await pluginManner.use(plugin2);

      // 静态数组中应该有两个插件
      expect(messagePluginManner.plugins).toHaveLength(2);

      // 但当前实例应该使用最新的插件 （单插件发送模式）
      await pluginManner.sendMessage(mockUiContext);
      expect(plugin1.sendMessage).not.toHaveBeenCalled();
      expect(plugin2.sendMessage).toHaveBeenCalledWith(mockUiContext);
    });
  });

  it("如果没有注册插件，应该不抛出错误", async () => {
    await expect(
      pluginManner.sendMessage(mockUiContext)
    ).resolves.not.toThrow();
  });

  it("sendMessage 方法抛出的错误应该被捕获并记录", async () => {
    // Mock console.error
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const error = new Error("Plugin error");
    const plugin = createMockPlugin({
      sendMessage: vi.fn().mockRejectedValue(error),
    });

    await pluginManner.use(plugin);

    // 应该不会抛出错误，而是被内部捕获
    await expect(
      pluginManner.sendMessage(mockUiContext)
    ).resolves.not.toThrow();

    // 验证 console.error 被调用，并且参数正确
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      `[messagePluginManner] Error sending message to plugin ${plugin.name}:${error}`
    );

    // 恢复 console.error
    consoleErrorSpy.mockRestore();
  });

  it("应该支持插件调用 UI 上下文的方法", async () => {
    const plugin: MessagePlugin = {
      name: "InteractivePlugin",
      sendMessage: async (context: MessagePluginnUiContext) => {
        context.setStatus("loading");
        context.addMessage({
          id: "test-id",
          content: "Test message",
          timestamp: Date.now(),
        });
        context.setStatus("success");
      },
    };

    await pluginManner.use(plugin);
    await pluginManner.sendMessage(mockUiContext);

    expect(mockUiContext.setStatus).toHaveBeenCalledWith("loading");
    expect(mockUiContext.addMessage).toHaveBeenCalled();
    expect(mockUiContext.setStatus).toHaveBeenCalledWith("success");
  });

  it("应该等待异步插件完成", async () => {
    let resolved = false;
    const plugin = createMockPlugin({
      sendMessage: vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        resolved = true;
      }),
    });

    await pluginManner.use(plugin);
    await pluginManner.sendMessage(mockUiContext);

    expect(resolved).toBe(true);
  });

  describe("abort", () => {
    it("应该调用插件的 abort 方法", async () => {
      const plugin = createMockPlugin();
      await pluginManner.use(plugin);

      await pluginManner.abort();

      expect(plugin.abort).toHaveBeenCalledTimes(1);
    });

    it("如果插件没有 abort 方法，应该不抛出错误", async () => {
      const pluginWithoutAbort: MessagePlugin = {
        name: "NoAbortPlugin",
        sendMessage: vi.fn().mockResolvedValue(undefined),
        abort: undefined,
      };

      await pluginManner.use(pluginWithoutAbort);
      await expect(pluginManner.abort()).resolves.not.toThrow();
    });

    it("应该在消息发送过程中可以调用 abort", async () => {
      let aborted = false;
      const plugin: MessagePlugin = {
        name: "AbortablePlugin",
        sendMessage: vi.fn().mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          if (!aborted) {
            throw new Error("Should have been aborted");
          }
        }),
        abort: vi.fn().mockImplementation(() => {
          aborted = true;
        }),
      };

      await pluginManner.use(plugin);

      // 启动发送但不等待
      const sendPromise = pluginManner.sendMessage(mockUiContext);

      // 立即中止
      await pluginManner.abort();

      expect(plugin.abort).toHaveBeenCalled();
      expect(aborted).toBe(true);
    });
  });

  //   describe("集成测试", () => {
  //     it("应该支持完整的插件生命周期", async () => {
  //       const lifecycleCalls: string[] = [];

  //       const plugin: MessagePlugin = {
  //         name: "LifecyclePlugin",
  //         version: "1.0.0",
  //         init: vi.fn().mockImplementation(async () => {
  //           lifecycleCalls.push("init");
  //         }),
  //         sendMessage: vi.fn().mockImplementation(async () => {
  //           lifecycleCalls.push("sendMessage");
  //         }),
  //         abort: vi.fn().mockImplementation(() => {
  //           lifecycleCalls.push("abort");
  //         }),
  //         destroy: vi.fn().mockImplementation(async () => {
  //           lifecycleCalls.push("destroy");
  //         }),
  //       };

  //       await pluginManner.use(plugin);
  //       await pluginManner.sendMessage(mockUiContext);
  //       await pluginManner.abort();

  //       expect(lifecycleCalls).toContain("sendMessage");
  //       expect(lifecycleCalls).toContain("abort");
  //     });

  //     it("应该支持多次发送消息", async () => {
  //       const plugin = createMockPlugin();
  //       await pluginManner.use(plugin);

  //       await pluginManner.sendMessage(mockUiContext);
  //       await pluginManner.sendMessage(mockUiContext);
  //       await pluginManner.sendMessage(mockUiContext);

  //       expect(plugin.sendMessage).toHaveBeenCalledTimes(3);
  //     });

  //     it("应该支持切换不同的插件", async () => {
  //       const plugin1 = createMockPlugin({ name: "Plugin1" });
  //       const plugin2 = createMockPlugin({ name: "Plugin2" });

  //       // 使用第一个插件
  //       await pluginManner.use(plugin1);
  //       await pluginManner.sendMessage(mockUiContext);

  //       expect(plugin1.sendMessage).toHaveBeenCalledTimes(1);
  //       expect(plugin2.sendMessage).not.toHaveBeenCalled();

  //       // 切换到第二个插件
  //       await pluginManner.use(plugin2);
  //       await pluginManner.sendMessage(mockUiContext);

  //       expect(plugin1.sendMessage).toHaveBeenCalledTimes(1);
  //       expect(plugin2.sendMessage).toHaveBeenCalledTimes(1);
  //     });
  //   });
});
