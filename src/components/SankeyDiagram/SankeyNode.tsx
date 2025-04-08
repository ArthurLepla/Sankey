import React from 'react';
import { ExtendedNode } from '../../types/SankeyTypes';

interface SankeyNodeProps {
    node: ExtendedNode;
    onClick?: (node: ExtendedNode) => void;
    isSelected?: boolean;
    isExpanded?: boolean;
    isExpandable?: boolean;
    isFocused?: boolean;
    isContextual?: boolean;
}

export const SankeyNode: React.FC<SankeyNodeProps> = ({ 
    node, 
    onClick, 
    isSelected,
    isExpanded,
    isExpandable,
    isFocused,
    isContextual
}) => {
    const handleClick = () => {
        if (onClick) {
            onClick(node);
        }
    };

    const width = node.x1 - node.x0;
    const height = node.y1 - node.y0;

    // Déterminer la couleur en fonction du niveau et du type d'énergie
    const getNodeColor = () => {
        const energyColors = {
            elec: '#1f77b4',
            gaz: '#ff7f0e',
            eau: '#2ca02c',
            air: '#d62728'
        };

        if (node.metadata?.energyType && energyColors[node.metadata.energyType as keyof typeof energyColors]) {
            return energyColors[node.metadata.energyType as keyof typeof energyColors];
        }

        // Couleurs par niveau si pas de type d'énergie
        const levelColors = ['#1f77b4', '#ff7f0e', '#2ca02c'];
        return levelColors[0] || '#999';
    };

    const getNodeClassName = () => {
        return `sankey-node ${isSelected ? 'selected' : ''} 
            ${isExpanded ? 'expanded' : ''} 
            ${isFocused ? 'focused' : ''} 
            ${!isContextual ? 'dimmed' : ''}`.trim();
    };

    return (
        <g
            transform={`translate(${node.x0},${node.y0})`}
            onClick={handleClick}
            className={getNodeClassName()}
            style={{ cursor: isExpandable ? 'pointer' : 'default' }}
        >
            <rect
                width={width}
                height={height}
                fill={getNodeColor()}
                fillOpacity={isSelected || isExpanded || isFocused ? 1 : 0.8}
                stroke={
                    isSelected ? "#ff0000" : 
                    isExpanded ? "#00ff00" : 
                    isFocused ? "#0066ff" : 
                    "#000"
                }
                strokeWidth={isSelected || isExpanded || isFocused ? 2 : 1}
            >
                <title>
                    {node.name}
                    {node.value ? ` (${node.value.toFixed(2)})` : ''}
                    {isExpandable ? '\nCliquez pour explorer' : ''}
                </title>
            </rect>
            <text
                x={-6}
                y={height / 2}
                dy=".35em"
                textAnchor="end"
                fontSize={10}
                fill={isFocused ? "#000" : "#666"}
                fontWeight={isSelected || isExpanded || isFocused ? "bold" : "normal"}
                style={{
                    transition: "font-weight 0.3s, fill 0.3s"
                }}
            >
                {node.name}
            </text>
            {isExpandable && (
                <text
                    x={width + 6}
                    y={height / 2}
                    dy=".35em"
                    textAnchor="start"
                    fontSize={12}
                    fill={isExpanded ? "#00ff00" : "#666"}
                >
                    {isExpanded ? '−' : '+'}
                </text>
            )}
        </g>
    );
}; 