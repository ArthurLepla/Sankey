interface SankeyNode {
    id: string;
    name: string;
    level: number;
    value: number;
    category: string;
}

interface SankeyLink {
    source: string;
    target: string;
    value: number;
    energyType?: string;
}

interface RawDataItem {
    id: string;
    name: string;
    value: number;
    level: number;
    levelName: string;
    category: string;
    parentId?: string;
    grandParentId?: string;
    greatGrandParentId?: string;
    energyType?: string;
}

export class DataAdapter {
    // ... existing code ...

    private createLinks(nodes: SankeyNode[], rawData: RawDataItem[]): SankeyLink[] {
        const links: SankeyLink[] = [];
        const nodeMap = new Map(nodes.map(node => [node.id, node]));

        rawData.forEach(item => {
            // Liens directs (parent)
            if (item.parentId) {
                const sourceNode = nodeMap.get(item.parentId);
                const targetNode = nodeMap.get(item.id);
                if (sourceNode && targetNode) {
                    links.push({
                        source: sourceNode.id,
                        target: targetNode.id,
                        value: item.value,
                        energyType: item.energyType
                    });
                }
            }

            // Liens avec le grand-parent (niveau N-2)
            if (item.grandParentId) {
                const sourceNode = nodeMap.get(item.grandParentId);
                const targetNode = nodeMap.get(item.id);
                if (sourceNode && targetNode) {
                    // Vérifier si le lien n'existe pas déjà via le parent
                    const existingLink = links.find(link => 
                        link.source === sourceNode.id && 
                        link.target === targetNode.id
                    );
                    if (!existingLink) {
                        links.push({
                            source: sourceNode.id,
                            target: targetNode.id,
                            value: item.value,
                            energyType: item.energyType
                        });
                    }
                }
            }

            // Liens avec l'arrière-grand-parent (niveau N-3)
            if (item.greatGrandParentId) {
                const sourceNode = nodeMap.get(item.greatGrandParentId);
                const targetNode = nodeMap.get(item.id);
                if (sourceNode && targetNode) {
                    // Vérifier si le lien n'existe pas déjà via le parent ou grand-parent
                    const existingLink = links.find(link => 
                        link.source === sourceNode.id && 
                        link.target === targetNode.id
                    );
                    if (!existingLink) {
                        links.push({
                            source: sourceNode.id,
                            target: targetNode.id,
                            value: item.value,
                            energyType: item.energyType
                        });
                    }
                }
            }
        });

        return links;
    }

    // ... rest of the code ...
} 