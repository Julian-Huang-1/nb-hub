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
    const stream = await this.openRouter.chat.send(
      {
        model: this.model,
        messages: APIMessages,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        stream: true,
      },
      {
        signal: options?.signal,
      }
    );

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
}
