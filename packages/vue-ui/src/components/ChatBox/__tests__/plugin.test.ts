import { describe, it, expect, beforeEach, vi } from "vitest";
import { PluginManager } from "../plugin";
import { MockAIPlugin } from "../plugins/MockAIPlugin";
import type { ChatBoxPlugin, PluginContext } from "../types";

describe("PluginManager", () => {
  let pluginManager: PluginManager;
  let mockContext: PluginContext;

  beforeEach(() => {
    pluginManager = new PluginManager();

    mockContext = {
      messages: [],
      status: "idle",
      setStatus: vi.fn(),
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      clearMessages: vi.fn(),
    };
  });

  describe("use", () => {
    it("should register a plugin", async () => {
      const plugin = new MockAIPlugin();
      await pluginManager.use(plugin);

      expect(pluginManager.hasPlugin()).toBe(true);
      expect(pluginManager.getPlugin()).toBe(plugin);
    });

    it("should call plugin init method", async () => {
      const plugin = new MockAIPlugin();
      const initSpy = vi.spyOn(plugin, "init");
      const config = { delay: 500 };

      await pluginManager.use(plugin, config);

      expect(initSpy).toHaveBeenCalledWith(config);
    });

    it("should destroy previous plugin when registering new one", async () => {
      const plugin1 = new MockAIPlugin();
      const plugin2 = new MockAIPlugin();
      const destroySpy = vi.spyOn(plugin1, "destroy");

      await pluginManager.use(plugin1);
      await pluginManager.use(plugin2);

      expect(destroySpy).toHaveBeenCalled();
      expect(pluginManager.getPlugin()).toBe(plugin2);
    });
  });

  describe("sendMessage", () => {
    it("should throw error if no plugin registered", async () => {
      await expect(
        pluginManager.sendMessage({ content: "test" }, mockContext)
      ).rejects.toThrow("No plugin registered");
    });

    it("should call plugin sendMessage method", async () => {
      const plugin = new MockAIPlugin();
      const sendSpy = vi.spyOn(plugin, "sendMessage");

      await pluginManager.use(plugin, { delay: 0 });
      await pluginManager.sendMessage({ content: "Hello" }, mockContext);

      expect(sendSpy).toHaveBeenCalledWith({ content: "Hello" }, mockContext);
    });
  });

  describe("abort", () => {
    it("should call plugin abort method if available", async () => {
      const plugin = new MockAIPlugin();
      const abortSpy = vi.spyOn(plugin, "abort");

      await pluginManager.use(plugin);
      pluginManager.abort();

      expect(abortSpy).toHaveBeenCalled();
    });

    it("should not throw if plugin has no abort method", async () => {
      const plugin: ChatBoxPlugin = {
        name: "TestPlugin",
        sendMessage: vi.fn(),
      };

      await pluginManager.use(plugin);
      expect(() => pluginManager.abort()).not.toThrow();
    });
  });

  describe("destroy", () => {
    it("should call plugin destroy method", async () => {
      const plugin = new MockAIPlugin();
      const destroySpy = vi.spyOn(plugin, "destroy");

      await pluginManager.use(plugin);
      await pluginManager.destroy();

      expect(destroySpy).toHaveBeenCalled();
      expect(pluginManager.hasPlugin()).toBe(false);
    });
  });
});
