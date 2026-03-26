import type { YooptaContentValue } from "@yoopta/editor";

export const LOCKED_BLOCK_ID = "title-block";

const buildLockedTitleBlock = (text: string) => ({
  id: LOCKED_BLOCK_ID,
  type: "HeadingOne",
  value: [
    {
      id: "title-block-el",
      type: "heading-one",
      children: [{ text }],
      props: { nodeType: "block" },
    },
  ],
  meta: { order: 0, depth: 0 },
});

export const ensureLockedTitleBlock = (
  value: YooptaContentValue | null | undefined,
): YooptaContentValue => {
  const current = (value ?? {}) as Record<string, unknown>;
  const previous = current[LOCKED_BLOCK_ID] as
    | {
        value?: Array<{ children?: Array<{ text?: string }> }>;
      }
    | undefined;

  const text = previous?.value?.[0]?.children?.[0]?.text ?? "未命名文档";

  return {
    ...current,
    [LOCKED_BLOCK_ID]: buildLockedTitleBlock(text),
  } as YooptaContentValue;
};
