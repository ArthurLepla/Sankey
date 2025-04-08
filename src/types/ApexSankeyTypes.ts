export interface SankeyOptions {
    width: number;
    height: number;
    canvasStyle?: string;
    spacing?: number;
    nodeWidth?: number;
    nodeBorderWidth?: number;
    nodeBorderColor?: string;
    onNodeClick?: (node: any) => void;
    edgeOpacity?: number;
    edgeGradientFill?: boolean;
    enableTooltip?: boolean;
    tooltipId?: string;
    tooltipBorderColor?: string;
    tooltipBGColor?: string;
    tooltipTemplate?: (data: { source: any; target: any; value: number }) => string;
    fontSize?: string;
    fontFamily?: string;
    fontWeight?: number;
    fontColor?: string;
    enableToolbar?: boolean;
    viewPortWidth?: number;
    viewPortHeight?: number;
}

export interface SankeyNode {
    id: string;
    title: string;
    color?: string;
}

export interface SankeyEdge {
    source: string;
    target: string;
    value: number;
}

export interface SankeyData {
    nodes: SankeyNode[];
    edges: SankeyEdge[];
    options?: SankeyOptions;
}

declare class ApexSankey {
    constructor(container: HTMLElement, options: SankeyOptions);
    render(data: SankeyData): void;
    destroy(): void;
}

export default ApexSankey; 