export interface BaseEntity {
    id: string;
    name: string;
}

export interface ConsumptionData {
    value: number;
    unit: string;
    timestamp?: Date;
}

export interface EnergyType {
    type: string;
    icon?: string;
    color?: string;
    defaultUnit: string;
}

export type NodeType = 'secteur' | 'atelier' | 'machine';

export interface NodeMetadata {
    type: NodeType;
    color?: string;
    order?: number;
} 