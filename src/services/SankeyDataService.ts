import { ExtendedNode, SimplifiedLink, SankeyData, DebugStats } from "../types/SankeyTypes";

export class SankeyDataService {
    public filterByEnergyType(data: SankeyData, energyType: string): SankeyData {
        // Filtrer les nœuds par type d'énergie
        const filteredNodes = data.nodes.filter(node => 
            node.metadata?.energyType === energyType
        );

        // Créer un ensemble des IDs des nœuds filtrés
        const nodeIds = new Set(filteredNodes.map(node => node.id));

        // Filtrer les liens pour ne garder que ceux qui concernent les nœuds filtrés
        const filteredLinks = data.links.filter(link => 
            nodeIds.has(link.source) && nodeIds.has(link.target)
        );

        return {
            nodes: filteredNodes,
            links: filteredLinks,
            levels: data.levels
        };
    }

    static validateData(data: SankeyData): boolean {
        // Éviter le spam des logs en vérifiant d'abord si les données sont nulles
        if (!data) {
            return false;
        }

        if (!data.nodes.length || !data.links.length) {
            console.warn("Validation Sankey : données vides", {
                nodesCount: data.nodes.length,
                linksCount: data.links.length
            });
            return false;
        }

        // Validation des nœuds
        const invalidNodes = data.nodes.filter(node => 
            !node.id || 
            !node.metadata?.level || 
            node.value < 0
        );

        if (invalidNodes.length > 0) {
            console.warn("Validation Sankey : nœuds invalides", {
                invalidCount: invalidNodes.length,
                firstInvalidNode: invalidNodes[0]
            });
            return false;
        }

        // Validation des liens
        const nodeIds = new Set(data.nodes.map(n => n.id));
        const invalidLinks = data.links.filter(link => 
            !nodeIds.has(link.source) || 
            !nodeIds.has(link.target) || 
            typeof link.value !== 'number' ||
            link.value <= 0
        );

        if (invalidLinks.length > 0) {
            console.warn("Validation Sankey : liens invalides", {
                invalidCount: invalidLinks.length,
                firstInvalidLink: invalidLinks[0],
                missingNodes: invalidLinks.filter(link => 
                    !nodeIds.has(link.source) || !nodeIds.has(link.target)
                ).map(link => ({
                    source: link.source,
                    target: link.target,
                    sourceExists: nodeIds.has(link.source),
                    targetExists: nodeIds.has(link.target)
                }))
            });
            return false;
        }

        return true;
    }

    static transformForD3(data: SankeyData) {
        const nodeMap = new Map(data.nodes.map((node, index) => [node.id, index]));
        
        return {
            nodes: data.nodes.map(node => ({
                ...node,
                index: nodeMap.get(node.id)
            })),
            links: data.links.map(link => ({
                source: nodeMap.get(link.source),
                target: nodeMap.get(link.target),
                value: link.value
            }))
        };
    }
} 