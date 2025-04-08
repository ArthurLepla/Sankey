import { BaseEntity, ConsumptionData, NodeMetadata } from './BaseTypes';

export interface HierarchyNodeMethods {
    getPath(): string[];
    getTotalConsumption(): number;
    findChild(id: string): HierarchyNode | undefined;
    findParent(id: string): HierarchyNode | undefined;
    isDescendantOf(node: HierarchyNode): boolean;
    isAncestorOf(node: HierarchyNode): boolean;
    getDepth(): number;
    getConsumptionByUnit(unit: string): number;
}

export interface HierarchyNodeData extends BaseEntity {
    metadata: NodeMetadata;
    consumption: ConsumptionData[];
    children?: HierarchyNode[];
    parent?: HierarchyNode;
    [key: string]: any; // Permettre des propriétés additionnelles
}

export interface HierarchyNode extends HierarchyNodeData, HierarchyNodeMethods {}

export interface SecteurNodeData extends HierarchyNodeData {
    metadata: NodeMetadata & { type: 'secteur' };
}

export interface SecteurNode extends SecteurNodeData, HierarchyNodeMethods {}

export interface AtelierNodeData extends HierarchyNodeData {
    metadata: NodeMetadata & { type: 'atelier' };
    secteur: SecteurNode;
}

export interface AtelierNode extends AtelierNodeData, HierarchyNodeMethods {}

export interface MachineNodeData extends HierarchyNodeData {
    metadata: NodeMetadata & { type: 'machine' };
    atelier?: AtelierNode;
    secteur: SecteurNode;
    energyType: string;
}

export interface MachineNode extends MachineNodeData, HierarchyNodeMethods {}

export interface HierarchyData {
    nodes: HierarchyNode[];
    links: HierarchyLink[];
    timeRange?: {
        start: Date;
        end: Date;
    };
}

export interface HierarchyLink {
    source: string;
    target: string;
    value: number;
}

// Implémentation des méthodes
export class HierarchyNodeImpl implements HierarchyNodeMethods {
    private node: HierarchyNodeData;

    constructor(node: HierarchyNodeData) {
        this.node = node;
    }

    getPath(): string[] {
        const path: string[] = [this.node.name];
        let current: HierarchyNode | undefined = this.node as HierarchyNode;
        
        while (current.parent) {
            path.unshift(current.parent.name);
            current = current.parent;
        }
        
        return path;
    }

    getTotalConsumption(): number {
        const nodeConsumption = this.node.consumption.reduce((sum, c) => sum + c.value, 0);
        const childrenConsumption = this.node.children?.reduce(
            (sum, child) => sum + new HierarchyNodeImpl(child).getTotalConsumption(),
            0
        ) || 0;
        
        return nodeConsumption + childrenConsumption;
    }

    findChild(id: string): HierarchyNode | undefined {
        if (!this.node.children) return undefined;
        
        const directChild = this.node.children.find(child => child.id === id);
        if (directChild) return directChild;
        
        for (const child of this.node.children) {
            const found = new HierarchyNodeImpl(child).findChild(id);
            if (found) return found;
        }
        
        return undefined;
    }

    findParent(id: string): HierarchyNode | undefined {
        if (!this.node.parent) return undefined;
        if (this.node.parent.id === id) return this.node.parent;
        return new HierarchyNodeImpl(this.node.parent).findParent(id);
    }

    isDescendantOf(node: HierarchyNode): boolean {
        let current = this.node.parent;
        while (current) {
            if (current.id === node.id) return true;
            current = current.parent;
        }
        return false;
    }

    isAncestorOf(node: HierarchyNode): boolean {
        return new HierarchyNodeImpl(node).isDescendantOf(this.node as HierarchyNode);
    }

    getDepth(): number {
        let depth = 0;
        let current = this.node.parent;
        while (current) {
            depth++;
            current = current.parent;
        }
        return depth;
    }

    getConsumptionByUnit(unit: string): number {
        return this.node.consumption
            .filter(c => c.unit === unit)
            .reduce((sum, c) => sum + c.value, 0);
    }
} 