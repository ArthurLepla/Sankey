import React from "react";

interface SankeyNavigationProps {
    view: "overview" | "detail";
    selectedNode: string | null;
    onBack: () => void;
}

export const SankeyNavigation: React.FC<SankeyNavigationProps> = ({
    view,
    selectedNode,
    onBack
}) => {
    return (
        <div className="sankey-navigation">
            <button
                className="sankey-back-button"
                onClick={onBack}
            >
                {view === "detail" ? "← Retour" : "Vue Générale"}
            </button>
            {selectedNode && (
                <div className="sankey-breadcrumb">
                    <span>Vue Générale / {selectedNode}</span>
                </div>
            )}
        </div>
    );
}; 