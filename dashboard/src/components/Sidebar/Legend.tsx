import React from "react";
import { TYPE_COLORS } from "../../constants";
import { useLocale } from "../../context/LocaleContext";

interface LegendProps {
  types: string[];
  graphTypeFilter: string | null;
  onFilterToggle: (type: string) => void;
}

const Legend: React.FC<LegendProps> = ({ types, graphTypeFilter, onFilterToggle }) => {
  const { getNodeTypeLabel, locale } = useLocale();

  return (
    <div className="legend-sidebar-list">
      <div className="legend-items" style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "16px" }}>
        {types.map(type => {
          const localizedName = getNodeTypeLabel(type);
          return (
            <div
              key={type}
              className={`filter-pill ${graphTypeFilter === type ? "active" : ""}`}
              onClick={() => onFilterToggle(type)}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}
            >
              <div style={{ display: "flex", alignItems: "center", overflow: "hidden", textOverflow: "ellipsis" }}>
                <div
                  className="legend-dot"
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: TYPE_COLORS[type],
                    marginRight: "12px",
                    flexShrink: 0
                  }}
                />
                <span style={{ fontWeight: 600 }}>{localizedName}</span>
              </div>
              {locale === "zh" && localizedName !== type && (
                <span style={{ fontSize: "11px", opacity: 0.45, marginLeft: "8px", fontFamily: "monospace" }}>
                  {type}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Legend;
