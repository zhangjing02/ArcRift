import React from "react";
import { useLocale } from "../../context/LocaleContext";

const SidebarHeader: React.FC = () => {
  const { t } = useLocale();

  return (
    <div className="sidebar-header">
      <div className="sidebar-title">{t.sidebar.title}</div>
      <div className="sidebar-subtitle">{t.sidebar.subtitle}</div>
    </div>
  );
};

export default SidebarHeader;
