// message-transformer/transform-strategies.ts

import type {
  ContentBlock,
  TextContent,
  ToolUseContent,
  ImageContent,
  FileContent,
} from "../ai-provider/aiProvider.interface";
import type {
  APIContentPart,
  APIFileContent,
  APIImageContent,
  APIMessage,
  ITransformStrategy,
} from "./message-transformer.interface";

/**
 * 文本块转换策略
 */
export class TextTransformStrategy implements ITransformStrategy {
  getSupportedType(): string {
    return "text";
  }
  transform(block: ContentBlock): APIContentPart {
    const textBlock = block as TextContent;
    return {
      type: "text",
      text: textBlock.text,
    };
  }
}

// /**
//  * 工具调用块转换策略
//  */
// export class ToolUseTransformStrategy implements ITransformStrategy {
//   getSupportedType(): string {
//     return "tool_use";
//   }

//   transform(block: ContentBlock): APIContentPart {
//     const toolBlock = block as ToolUseContent;
//     return {
//       type: "function",
//       id: toolBlock.id,
//       name: toolBlock.name,
//       arguments: toolBlock.arguments,
//     };
//   }
// }

/**
 * 图片块转换策略
 */
export class ImageTransformStrategy implements ITransformStrategy {
  getSupportedType(): string {
    return "image_url";
  }
  transform(block: ContentBlock): APIImageContent {
    const imageBlock = block as ImageContent;
    return {
      type: "image_url",
      imageUrl: {
        url: imageBlock.imageUrl.url,
      },
    };
  }
}

export class FileTransformStrategy implements ITransformStrategy {
  getSupportedType(): string {
    return "file";
  }
  transform(block: ContentBlock): APIFileContent {
    const fileBlock = block as FileContent;
    return {
      type: "file",
      file: {
        filename: fileBlock.file.filename,
        file_data: fileBlock.file.file_data,
      },
    };
  }
}
