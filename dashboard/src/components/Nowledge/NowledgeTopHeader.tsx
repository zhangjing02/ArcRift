import React from "react";
import type { NavTab } from "./NowledgeSidebar";
import type { Session } from "../../types";

interface NowledgeTopHeaderProps {
  currentTab: NavTab;
  activeSession: Session | null;
  selectedMemoryTitle?: string | null;
}

export const NowledgeTopHeader: React.FC<NowledgeTopHeaderProps> = ({
  currentTab,
  activeSession,
  selectedMemoryTitle,
}) => {
  const getTabDetails = () => {
    switch (currentTab) {
      case "memories":
        return {
          icon: "🗂",
          title: "记忆",
          subtitle: selectedMemoryTitle
            ? `查看记忆: ${selectedMemoryTitle}`
            : "查看和管理你的记忆",
        };
      case "timeline":
        return {
          icon: "⏱",
          title: "时间线",
          subtitle: "浏览每日记忆流和知识活动",
        };
      case "threads":
        return {
          icon: "💬",
          title: "会话记录",
          subtitle: "导入和回顾你的 AI 对话历史",
        };
      case "ai-now":
        return {
          icon: "✨",
          title: "AI Now",
          subtitle: "智能提炼、总结与上下文结晶",
        };
      case "graph":
        return {
          icon: "🌐",
          title: "知识图谱",
          subtitle: "探索实体三元组与关联网络",
        };
      case "tree":
        return {
          icon: "🌳",
          title: "知识树",
          subtitle: "结构化多维知识分类体系",
        };
      case "skills":
        return {
          icon: "⚡",
          title: "技能",
          subtitle: "管理与调度智能体 Skills",
        };
      case "context":
        return {
          icon: "📋",
          title: "上下文",
          subtitle: "工作记忆与实时状态简报",
        };
      case "library":
        return {
          icon: "📚",
          title: "资料库",
          subtitle: "管理知识源与文件索引",
        };
      case "connect":
        return {
          icon: "🔗",
          title: "连接",
          subtitle: "连接你的 AI 编程智能体",
        };
      case "settings":
        return {
          icon: "⚙️",
          title: "设置",
          subtitle: "AI 模型与知识库偏好设置",
        };
      case "stats":
        return {
          icon: "📊",
          title: "统计",
          subtitle: "知识库数据概览与指标",
        };
      case "feedback":
        return {
          icon: "💬",
          title: "反馈",
          subtitle: "问题反馈与建议",
        };
      default:
        return {
          icon: "🧠",
          title: "ChronosMind",
          subtitle: "AI 连续记忆与知识图谱工作台",
        };
    }
  };

  const details = getTabDetails();

  return (
    <header className="nl-top-header">
      <div className="nl-top-header-left">
        <span className="nl-top-header-icon">{details.icon}</span>
        <div className="nl-top-header-text">
          <span className="nl-top-header-title">{details.title}</span>
          <span className="nl-top-header-subtitle" title={details.subtitle}>
            {details.subtitle}
          </span>
        </div>
      </div>

      <div className="nl-top-header-right">
        <span className="nl-top-space-tag">
          {activeSession && activeSession._id !== "all"
            ? `📁 ${activeSession.projectName}`
            : "🌟 全部空间"}
        </span>
      </div>
    </header>
  );
};
