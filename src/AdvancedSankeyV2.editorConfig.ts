import { ReactElement, createElement } from "react";
import { AdvancedSankeyV2PreviewProps } from "../typings/AdvancedSankeyV2Props";
import { hidePropertiesIn, Problem, Properties as MendixProperties } from "@mendix/pluggable-widgets-tools";

export type Platform = "web" | "desktop";

export type Properties = {
    caption: string;
    propertyGroups?: Properties[];
    properties?: Property[];
}[];

type Property = {
    key: string;
    caption: string;
    description?: string;
};

export function getProperties(values: AdvancedSankeyV2PreviewProps, defaultProperties: MendixProperties): MendixProperties {
    return defaultProperties;
}

export function check(values: AdvancedSankeyV2PreviewProps): Problem[] {
    const errors: Problem[] = [];

    if (!values.hierarchyConfig || values.hierarchyConfig.length === 0) {
        errors.push({
            property: "hierarchyConfig",
            message: "Au moins un niveau hiérarchique doit être configuré."
        });
    }

    // Vérification des IDs uniques des niveaux
    const levelIds = new Set<string>();
    values.hierarchyConfig?.forEach(config => {
        if (levelIds.has(config.levelId)) {
            errors.push({
                property: "hierarchyConfig",
                message: `L'identifiant de niveau '${config.levelId}' est utilisé plusieurs fois. Les identifiants doivent être uniques.`
            });
        }
        levelIds.add(config.levelId);

        // Vérification de l'entité du niveau
        if (!config.entityPath) {
            errors.push({
                property: "hierarchyConfig",
                message: `L'entité source est requise pour le niveau '${config.levelId}'.`
            });
        }

        // Vérification de l'ordre des niveaux
        if (config.levelOrder === null || config.levelOrder < 0) {
            errors.push({
                property: "hierarchyConfig",
                message: `L'ordre du niveau '${config.levelId}' doit être un nombre positif ou nul.`
            });
        }
    });

    // Vérification de l'ordre des niveaux
    const orders = values.hierarchyConfig?.map(config => config.levelOrder) || [];
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) {
        errors.push({
            property: "hierarchyConfig",
            message: "Chaque niveau doit avoir un ordre unique."
        });
    }

    return errors;
}

export function getPreview(values: AdvancedSankeyV2PreviewProps, isDarkMode: boolean): ReactElement {
    return createElement(
        "div",
        {
            style: {
                border: "1px dashed #ccc",
                height: "400px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                fontSize: "14px",
                color: isDarkMode ? "#FFFFFF" : "#000000",
                backgroundColor: isDarkMode ? "#454545" : "#FFFFFF"
            }
        },
        createElement("div", null, "Advanced Sankey Diagram Preview"),
        createElement("div", null, values.title || "Diagramme Sankey"),
        createElement("div", null, `${values.hierarchyConfig?.length || 0} niveau(x) configuré(s)`)
    );
}

export function getCustomCaption(values: AdvancedSankeyV2PreviewProps): string {
    return values.title || "Advanced Sankey Diagram";
}