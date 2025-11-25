import type { MessagePlugin, MessagePluginnUiContext } from "./types";

export class MokeApiPlugin implements MessagePlugin {
  name = "MokeApiPlugin";
  version = "1.0.0";

  async sendMessage(uiContext: MessagePluginnUiContext): Promise<void> {
    console.log("sendMessage", uiContext);
  }

  async abort(): Promise<void> {
    console.log("abort");
  }

  async destroy(): Promise<void> {
    console.log("destroy");
  }
}
