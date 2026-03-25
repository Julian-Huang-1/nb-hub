import { confusionsRepository } from "../confusions/confusions.repository.js";

const getStartOfWeek = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const periodKey = (date: Date) => date.toISOString().slice(0, 10);

export const analyticsService = {
  getConfusionStats() {
    const weekStart = getStartOfWeek();
    const total = confusionsRepository.countAll();
    const open = confusionsRepository.countByStatus("open");
    const resolved = confusionsRepository.countByStatus("resolved");
    const createdThisWeek = confusionsRepository.countCreatedAfter(weekStart);
    const resolvedRate = total === 0 ? 0 : Number((resolved / total).toFixed(4));

    return {
      total,
      open,
      resolved,
      createdThisWeek,
      resolvedRate,
    };
  },

  generateWeeklySolutionDoc() {
    const weekStart = getStartOfWeek();
    const resolved = confusionsRepository.listResolvedInPeriod(weekStart);
    const stats = this.getConfusionStats();
    const title = `本周困惑解决方案 (${periodKey(weekStart)})`;
    const contentMd = [
      `# ${title}`,
      "",
      "## 统计",
      `- 困惑总数: ${stats.total}`,
      `- 已解决: ${stats.resolved}`,
      `- 待解决: ${stats.open}`,
      `- 本周新增: ${stats.createdThisWeek}`,
      "",
      "## 已解决清单",
      ...(resolved.length > 0
        ? resolved.map((item, index) => `${index + 1}. ${item.title}\n\n${item.description}`)
        : ["本周暂无已解决困惑。"]),
      "",
    ].join("\n");

    return confusionsRepository.upsertSolutionDoc({
      periodKey: periodKey(weekStart),
      title,
      contentMd,
      statsJson: JSON.stringify(stats),
    });
  },

  listSolutionDocs() {
    return confusionsRepository.listSolutionDocs();
  },
};
