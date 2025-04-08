import { 
    HierarchyNodeData,
    SecteurNodeData,
    AtelierNodeData,
    MachineNodeData,
    SecteurNode, 
    AtelierNode, 
    MachineNode,
    HierarchyNodeImpl 
} from '../types/models/HierarchyTypes';
import { COLORS } from '../utils/constants';

export class NodeFactory {
    public static createSecteurNode(
        id: string,
        name: string
    ): SecteurNode {
        const nodeData: SecteurNodeData = {
            id,
            name,
            metadata: {
                type: 'secteur',
                color: COLORS.secteur
            },
            consumption: [],
            children: []
        };

        return new HierarchyNodeImpl(nodeData) as unknown as SecteurNode;
    }

    public static createAtelierNode(
        id: string,
        name: string,
        secteur: SecteurNode
    ): AtelierNode {
        const nodeData: AtelierNodeData = {
            id,
            name,
            metadata: {
                type: 'atelier',
                color: COLORS.atelier
            },
            consumption: [],
            children: [],
            secteur
        };

        return new HierarchyNodeImpl(nodeData) as unknown as AtelierNode;
    }

    public static createMachineNode(
        id: string,
        name: string,
        secteur: SecteurNode,
        atelier: AtelierNode | undefined,
        energyType: string,
        consumption: Array<{ value: number; unit: string; timestamp?: Date }>
    ): MachineNode {
        const nodeData: MachineNodeData = {
            id,
            name,
            metadata: {
                type: 'machine',
                color: COLORS.machine
            },
            consumption,
            children: [],
            secteur,
            atelier,
            energyType
        };

        return new HierarchyNodeImpl(nodeData) as unknown as MachineNode;
    }
} 