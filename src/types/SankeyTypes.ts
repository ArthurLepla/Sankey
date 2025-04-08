import { ListValue, ListAttributeValue, ObjectItem } from "mendix";

export type NodeType = "secteur" | "atelier" | "machine";

export interface MendixObjectItem extends ObjectItem {
    name: string;
    value: number;
    level: number;
    category: string;
    energyType?: string;
}

export interface BaseNode {
    id: string;
    name: string;
    category: string;
    value: number;
    metadata?: {
        type?: string;
        level?: string | number;
        energyType?: string;
    };
}

export interface ExtendedNode extends BaseNode {
    index: number;
    x0: number;
    x1: number;
    y0: number;
    y1: number;
    sourceLinks: any[];
    targetLinks: any[];
}

export interface ExtendedLink {
    source: ExtendedNode;
    target: ExtendedNode;
    value: number;
    width: number;
    y0: number;
    y1: number;
    index: number;
    metadata?: {
        sourceLevel: string;
        targetLevel: string;
        isDirectLink?: boolean;
    };
}

export interface SimplifiedLink {
    source: string;
    target: string;
    value: number;
    metadata?: {
        sourceLevel?: string | number;
        targetLevel?: string | number;
        isDirectLink?: boolean;
        skipLevels?: boolean;
    };
}

export interface HierarchyLevel {
    level: number;
    name: string;
}

export interface SankeyData {
    nodes: ExtendedNode[];
    links: SimplifiedLink[];
    levels: HierarchyLevel[];
}

export interface EnergyConfig {
    icon: any;
    color: string;
    unit: string;
}

export interface EnergyConfigs {
    [key: string]: EnergyConfig;
}

export interface ColorScheme {
    [key: string]: string;
    link: string;
}

export interface ValidationStats {
    total: number;
    valid: number;
    invalid: number;
    withWorkshop: number;
    withoutWorkshop: number;
}

export interface NodeStats {
    sectors: {
        count: number;
        list: string[];
    };
    workshops: {
        count: number;
        list: string[];
    };
    machines: {
        count: number;
        byEnergy: { [key: string]: number };
        bySector: { [key: string]: number };
        byWorkshop: { [key: string]: number };
    };
}

export interface LinkStats {
    total: number;
    sectorToWorkshop: number;
    workshopToMachine: number;
    sectorToMachine: number;
    orphanedLinks: string[];
}

export interface DebugStats {
    timestamp: string;
    hierarchyData: {
        nodes: ExtendedNode[];
        links: SimplifiedLink[];
        levels: HierarchyLevel[];
    };
    validationStats: {
        total: number;
        valid: number;
        invalid: number;
        withWorkshop: number;
        withoutWorkshop: number;
    };
    nodeStats: {
        sectors: {
            count: number;
            list: string[];
        };
        workshops: {
            count: number;
            list: string[];
        };
        machines: {
            count: number;
            byEnergy: { [key: string]: number };
            bySector: { [key: string]: number };
            byWorkshop: { [key: string]: number };
        };
    };
    linkStats: {
        total: number;
        sectorToWorkshop: number;
        workshopToMachine: number;
        sectorToMachine: number;
        orphanedLinks: string[];
    };
    errors: string[];
    warnings: string[];
    performance: {
        startTime: number;
        endTime: number;
        duration: number;
        nodeProcessingTime: number;
        linkProcessingTime: number;
    };
    summary: {
        timestamp: string;
        totalNodes: number;
        totalLinks: number;
        validationRate: string;
        workshopAttachmentRate: string;
        processingTime: string;
    };
}

export interface SankeyProps {
    data: SankeyData;
    nodeWidth?: number;
    nodePadding?: number;
    onNodeClick?: (node: BaseNode) => void;
    selectedNode?: string | null;
    view?: "overview" | "detail";
}

export interface MendixSankeyNodeData {
    id: string;
    name: string;
    value: number;
    level: number;
    levelId: string;
    category: string;
    energyType?: string;
    parentId?: string;
    ancestor?: {
        levelId: string;
        id: string;
    };
} 