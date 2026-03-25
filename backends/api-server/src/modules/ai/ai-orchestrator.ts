type ExtractedConfusion = {
  title: string;
  description: string;
  tags: string[];
};

const pickTags = (text: string) => {
  const tags: string[] = [];
  if (/[cC]ode|代码|ts|js|vue|react/.test(text)) tags.push("coding");
  if (/架构|architecture|design/i.test(text)) tags.push("architecture");
  if (/性能|performance/i.test(text)) tags.push("performance");
  if (/学习|learn|理解|concept/i.test(text)) tags.push("learning");
  return tags.length > 0 ? tags : ["general"];
};

export const aiOrchestrator = {
  buildAssistantReply(input: { question: string }) {
    return `我理解你的问题是：${input.question}\n\n建议先拆解目标、确认约束，再逐步验证方案。`;
  },

  extractConfusions(input: { question: string }): ExtractedConfusion[] {
    const text = input.question.trim();
    if (!text) return [];
    return [
      {
        title: text.slice(0, 60),
        description: text,
        tags: pickTags(text),
      },
    ];
  },

  buildResolutionMarkdown(input: { question: string; answer: string }) {
    return `## 困惑\n\n${input.question}\n\n## 解决方案\n\n${input.answer}\n`;
  },
};
