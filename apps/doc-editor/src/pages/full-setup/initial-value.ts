import type { YooptaContentValue } from "@yoopta/editor";

export const fullSetupInitialValue = {
  "title-block": {
    id: "title-block",
    type: "HeadingOne",
    value: [
      {
        id: "title-block-el",
        type: "heading-one",
        children: [
          {
            text: "未命名文档",
          },
        ],
        props: {
          nodeType: "block",
        },
      },
    ],
    meta: {
      order: 0,
      depth: 0,
    },
  },
} as unknown as YooptaContentValue;
