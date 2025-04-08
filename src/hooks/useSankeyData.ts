import { useEffect, useState } from "react";
import { ValueStatus } from "mendix";
import { SankeyData, ExtendedNode } from "../types/SankeyTypes";
import { AdvancedSankeyV2ContainerProps } from "../../typings/AdvancedSankeyV2Props";

export function useSankeyData(props: AdvancedSankeyV2ContainerProps): SankeyData | null {
    const [sankeyData, setSankeyData] = useState<SankeyData | null>(null);

    useEffect(() => {
        try {
            // Vérifier que toutes les entités sont disponibles
            const areEntitiesAvailable = props.hierarchyConfig.every(
                config => config.entityPath && config.entityPath.status === ValueStatus.Available
            );

            if (!areEntitiesAvailable) {
                console.log("Certaines entités ne sont pas encore disponibles");
                return;
            }

            // Trier les niveaux par ordre
            const sortedLevels = [...props.hierarchyConfig].sort((a, b) => a.levelOrder - b.levelOrder);

            // Traiter les données de chaque niveau
            const nodesMap = new Map<string, ExtendedNode>();
            const links: Array<{ source: string; target: string; value: number }> = [];

            // Créer les nœuds pour chaque niveau
            sortedLevels.forEach((levelConfig) => {
                const items = levelConfig.entityPath.items || [];
                items.forEach((item, itemIndex) => {
                    const nameValue = levelConfig.nameAttribute.get(item);
                    const value = levelConfig.valueAttribute.get(item);
                    
                    if (nameValue && nameValue.value !== undefined && value && value.value !== undefined) {
                        const name = nameValue.value;
                        const nodeId = `${levelConfig.levelId}_${name}`;
                        
                        // Créer le nœud s'il n'existe pas déjà
                        if (!nodesMap.has(nodeId)) {
                            nodesMap.set(nodeId, {
                                id: nodeId,
                                name: name,
                                value: Number(value.value),
                                category: levelConfig.levelId,
                                index: itemIndex,
                                x0: 0,
                                x1: 0,
                                y0: 0,
                                y1: 0,
                                sourceLinks: [],
                                targetLinks: [],
                                metadata: {
                                    level: levelConfig.levelOrder,
                                    type: levelConfig.levelId
                                }
                            });
                        }

                        // Traiter les références aux parents
                        const parentAttributes = [
                            { attr: levelConfig.parentLevel2NameAttribute, level: 2 },
                            { attr: levelConfig.parentLevel1NameAttribute, level: 1 },
                            { attr: levelConfig.parentLevel0NameAttribute, level: 0 }
                        ];

                        // Essayer chaque référence parent jusqu'à trouver une valide
                        for (const { attr, level } of parentAttributes) {
                            if (attr) {
                                const parentNameValue = attr.get(item);
                                if (parentNameValue && parentNameValue.value !== undefined) {
                                    // Trouver le niveau parent correspondant
                                    const parentLevel = sortedLevels.find(l => l.levelOrder === level);
                                    if (parentLevel) {
                                        const parentNodeId = `${parentLevel.levelId}_${parentNameValue.value}`;
                                        // Ajouter le lien si le parent existe
                                        if (nodesMap.has(parentNodeId)) {
                                            links.push({
                                                source: parentNodeId,
                                                target: nodeId,
                                                value: Number(value.value)
                                            });
                                            // Une fois qu'un parent valide est trouvé, on arrête la recherche
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                });
            });

            // Créer la structure finale des données Sankey
            const sankeyData: SankeyData = {
                nodes: Array.from(nodesMap.values()),
                links: links,
                levels: sortedLevels.map(config => ({
                    level: config.levelOrder,
                    name: config.levelName
                }))
            };

            setSankeyData(sankeyData);

        } catch (error) {
            console.error("Erreur lors du traitement des données:", error);
            setSankeyData(null);
        }
    }, [props.hierarchyConfig]);

    return sankeyData;
} 