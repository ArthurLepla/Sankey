import React, { useRef, useState, useEffect, useMemo } from 'react';
import { sankey, sankeyLinkHorizontal, SankeyGraph } from 'd3-sankey';
import { SankeyProps, SankeyData, ExtendedNode, ExtendedLink } from '../../types/SankeyTypes';
import { SankeyDataService } from '../../services/SankeyDataService';
import { SankeyNode } from './SankeyNode';
import { SankeyLink } from './SankeyLink';
import './styles.css';

export const SankeyDiagram: React.FC<SankeyProps> = ({ 
    data,
    nodeWidth = 30,
    nodePadding = 50,
    onNodeClick 
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    useEffect(() => {
        if (containerRef.current) {
            const { width: containerWidth, height: containerHeight } = 
                containerRef.current.getBoundingClientRect();
            setDimensions({ 
                width: containerWidth || 800, 
                height: containerHeight || 600 
            });
        }
    }, []);

    const sankeyData = useMemo(() => {
        if (!SankeyDataService.validateData(data)) {
            console.error("Données Sankey invalides");
            return null;
        }

        const nodeMap = new Map(data.nodes.map((node, index) => [node.id, index]));
        
        const processedData = {
            nodes: data.nodes.map(node => ({
                ...node,
                index: nodeMap.get(node.id) || 0,
                x0: 0,
                x1: 0,
                y0: 0,
                y1: 0,
                sourceLinks: [],
                targetLinks: []
            })),
            links: data.links.map((link, index) => ({
                source: nodeMap.get(link.source) || 0,
                target: nodeMap.get(link.target) || 0,
                value: link.value,
                index,
                width: 0,
                y0: 0,
                y1: 0
            }))
        };

        const sankeyLayout = sankey<ExtendedNode, ExtendedLink>()
            .nodeWidth(nodeWidth)
            .nodePadding(nodePadding)
            .extent([[1, 1], [dimensions.width - 1, dimensions.height - 6]]);

        const { nodes, links } = sankeyLayout(processedData as any);

        return { 
            nodes: nodes as ExtendedNode[], 
            links: links as ExtendedLink[] 
        };
    }, [data, dimensions, nodeWidth, nodePadding]);

    if (!sankeyData) {
        return <div className="sankey-error">Données invalides</div>;
    }

    return (
        <div ref={containerRef} className="sankey-container">
            <svg 
                width={dimensions.width} 
                height={dimensions.height}
                className="sankey-svg"
            >
                <g className="sankey-links">
                    {sankeyData.links.map((link, i) => (
                        <SankeyLink
                            key={`${link.source.id}-${link.target.id}-${i}`}
                            link={link}
                        />
                    ))}
                </g>
                <g className="sankey-nodes">
                    {sankeyData.nodes.map(node => (
                        <SankeyNode
                            key={node.id}
                            node={node}
                            onClick={onNodeClick}
                        />
                    ))}
                </g>
            </svg>
        </div>
    );
}; 