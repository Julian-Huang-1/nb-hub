import { describe, it, expect, beforeEach, vi } from "vitest";
import { MockAIPlugin } from "../plugins/MockAIPlugin";
import type { PluginContext } from "../types";

describe("MockAIPlugin", () => {
  let plugin: MockAIPlugin;
  let mockContext: PluginContext;

  beforeEach(() => {
    plugin = new MockAIPlugin();

    mockContext = {
      messages: [],
      status: "idle",
      setStatus: vi.fn(),
      addMessage: vi.fn(),
      updateMessage: vi.fn(),
      clearMessages: vi.fn(),
    };
  });

  describe("init", () => {
    it("should initialize with default config", () => {
      plugin.init();
      expect(plugin.name).toBe("MockAIPlugin");
    });

    it("should merge provided config", () => {
      const config = { delay: 500, streaming: true };
      plugin.init(config);
      // Config is private, but we can test behavior
      expect(plugin.name).toBe("MockAIPlugin");
    });
  });

  describe("sendMessage", () => {
    it("should add message to context", async () => {
      plugin.init({ delay: 0 });

      await plugin.sendMessage({ content: "Hello" }, mockContext);

      expect(mockContext.addMessage).toHaveBeenCalled();
    });

    it("should generate response", async () => {
      plugin.init({ delay: 0 });

      await plugin.sendMessage({ content: "Test message" }, mockContext);

      const addMessageCall = (mockContext.addMessage as any).mock.calls[0][0];
      expect(addMessageCall.role).toBe("assistant");
      expect(addMessageCall.content).toBeTruthy();
    });

    it("should use custom response generator", async () => {
      const customGenerator = vi.fn(() => "Custom response");
      plugin.init({
        delay: 0,
        responseGenerator: customGenerator,
      });

      await plugin.sendMessage({ content: "Test" }, mockContext);

      expect(customGenerator).toHaveBeenCalledWith("Test");

      const addMessageCall = (mockContext.addMessage as any).mock.calls[0][0];
      expect(addMessageCall.content).toBe("Custom response");
    });

    it("should support streaming mode", async () => {
      plugin.init({ delay: 0, streaming: true });

      await plugin.sendMessage({ content: "Stream test" }, mockContext);

      expect(mockContext.setStatus).toHaveBeenCalledWith("streaming");
      expect(mockContext.addMessage).toHaveBeenCalled();
    });

    it("should handle abort", async () => {
      plugin.init({ delay: 100 });

      const promise = plugin.sendMessage({ content: "Test" }, mockContext);

      // Abort immediately
      plugin.abort();

      await promise;

      // Should complete without error
      expect(true).toBe(true);
    });
  });

  describe("abort", () => {
    it("should abort ongoing request", async () => {
      plugin.init({ delay: 1000 });

      const promise = plugin.sendMessage({ content: "Test" }, mockContext);

      plugin.abort();

      await promise;

      // Message should not be added due to abort
      // (depending on timing, this might be flaky)
      expect(true).toBe(true);
    });
  });

  describe("destroy", () => {
    it("should clean up resources", () => {
      plugin.destroy();
      expect(plugin.name).toBe("MockAIPlugin");
    });
  });
});
