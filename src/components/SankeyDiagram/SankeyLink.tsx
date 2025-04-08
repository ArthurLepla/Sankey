import React from 'react';
import { sankeyLinkHorizontal } from 'd3-sankey';
import { ExtendedNode, ExtendedLink } from '../../types/SankeyTypes';

interface SankeyLinkProps {
    link: {
        source: ExtendedNode & {
            x0: number;
            x1: number;
            y0: number;
            y1: number;
        };
        target: ExtendedNode & {
            x0: number;
            x1: number;
            y0: number;
            y1: number;
        };
        width: number;
        value: number;
        metadata?: {
            sourceLevel: string;
            targetLevel: string;
            isDirectLink?: boolean;
            skipLevels?: boolean;
        };
    };
    isHighlighted?: boolean;
}

export const SankeyLink: React.FC<SankeyLinkProps> = ({ link, isHighlighted }) => {
    const path = sankeyLinkHorizontal();

    // Déterminer la couleur du lien en fonction du nœud source
    const getLinkColor = () => {
        const sourceNode = link.source;
        if (sourceNode.metadata?.energyType) {
            const energyColors = {
                elec: '#1f77b4',
                gaz: '#ff7f0e',
                eau: '#2ca02c',
                air: '#d62728'
            };
            return energyColors[sourceNode.metadata.energyType as keyof typeof energyColors] || '#999';
        }
        return '#999';
    };

    // Style spécial pour les liens qui sautent des niveaux
    const getStrokeDasharray = () => {
        return link.metadata?.skipLevels ? "5,5" : "none";
    };

    return (
        <path
            d={path(link as any) || undefined}
            style={{
                fill: 'none',
                stroke: getLinkColor(),
                strokeOpacity: isHighlighted ? 0.8 : 0.2,
                strokeWidth: Math.max(1, isHighlighted ? link.width * 1.5 : link.width),
                strokeDasharray: getStrokeDasharray(),
                transition: 'stroke-opacity 0.3s, stroke-width 0.3s'
            }}
        >
            <title>
                {link.source.name} → {link.target.name}
                {link.value ? ` (${link.value.toFixed(2)})` : ''}
                {link.metadata?.skipLevels ? '\n(Lien direct)' : ''}
            </title>
        </path>
    );
}; 