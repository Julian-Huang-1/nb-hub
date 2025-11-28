import { MessageTransformer } from "../message-transformer/transformer";
import type {
  ChatOptions,
  IAiProvider,
  Message,
  StreamChunk,
} from "./aiProvider.interface";
import { OpenRouter } from "@openrouter/sdk";

export class OpenRouteProvider implements IAiProvider {
  private apiKey: string = "";
  private model: string = "";
  private openRouter: any = null;
  private messageTransformer: MessageTransformer = new MessageTransformer();

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  init() {
    if (!this.openRouter) {
      this.openRouter = new OpenRouter({
        apiKey: this.apiKey,
      });
    }
  }

  async *chatStream(
    messages: Message[],
    options?: ChatOptions
  ): AsyncIterableIterator<StreamChunk> {
    if (!this.openRouter) {
      this.init();
    }
    const APIMessages = this.messageTransformer.transform(messages);
    console.log({
      APIMessages,
    });
    // const stream = await this.openRouter.chat.send(
    //   {
    //     model: this.model,
    //     messages: APIMessages,
    //     temperature: options?.temperature,
    //     max_tokens: options?.maxTokens,
    //     stream: true,
    //     modalities: ["image", "text"],
    //   },
    //   {
    //     signal: options?.signal,
    //   }
    // );

    const stream = this.fetchOpenRouter({
      model: this.model,
      messages: APIMessages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      stream: true,
      // modalities: ["image", "text"],
    });

    yield* stream;
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<Message[]> {
    if (!this.openRouter) {
      this.init();
    }

    const response = await this.openRouter.chat.send(
      {
        model: this.model,
        messages,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        stream: false,
      },
      {
        signal: options?.signal,
      }
    );

    return response.choices[0]?.message || [];
  }

  async *fetchOpenRouter(config: any) {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...config,
        }),
      }
    );

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Append new chunk to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from buffer
        while (true) {
          const lineEnd = buffer.indexOf("\n");
          if (lineEnd === -1) break;

          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);

          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;

            try {
              const parsed = JSON.parse(data);
              console.log(parsed.choices[0].delta);
              yield parsed; // yield 每个数据块
            } catch (e) {
              // Ignore invalid JSON
            }
          }
        }
      }
    } finally {
      reader.cancel();
    }
  }
}
