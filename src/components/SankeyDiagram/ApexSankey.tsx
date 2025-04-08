import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { sankey, SankeyNode, SankeyLink, sankeyLinkHorizontal } from 'd3-sankey';
import { SankeyData, BaseNode } from '../../types/SankeyTypes';
import { SankeyBreadcrumbs } from './SankeyBreadcrumbs';

interface ApexSankeyProps {
    data: SankeyData;
    onNodeClick?: (node: BaseNode) => void;
    unitOfMeasure?: string;
}

type ExtendedSankeyNode = SankeyNode<BaseNode, any> & BaseNode;
type ExtendedSankeyLink = SankeyLink<BaseNode, BaseNode>;

export const ApexSankeyDiagram: React.FC<ApexSankeyProps> = ({ data, onNodeClick, unitOfMeasure = 'kWh' }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    useEffect(() => {
        if (!containerRef.current || !data.nodes.length) return;

        const width = containerRef.current.clientWidth;
        const height = 600;
        const margin = { top: 20, right: 20, bottom: 20, left: 20 };

        // Nettoyer le conteneur
        d3.select(containerRef.current).selectAll("*").remove();

        // Créer le SVG
        const svg = d3.select(containerRef.current)
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Filtrer les données en fonction du nœud sélectionné
        let filteredData;
        if (selectedNodeId) {
            // Vue détaillée : montrer le nœud sélectionné et ses connexions directes
            const selectedNode = data.nodes.find(n => n.id === selectedNodeId);
            const connectedLinks = data.links.filter(link => 
                link.source === selectedNodeId || link.target === selectedNodeId
            );
            const connectedNodeIds = new Set([
                selectedNodeId,
                ...connectedLinks.map(link => link.source === selectedNodeId ? link.target : link.source)
            ]);
            
            filteredData = {
                nodes: data.nodes.filter(node => connectedNodeIds.has(node.id)),
                links: connectedLinks
            };
        } else {
            // Vue initiale : montrer tous les nœuds du niveau 0 et leurs connexions directes
            const level0Nodes = data.nodes.filter(node => node.metadata?.level === 0);
            const level0NodeIds = new Set(level0Nodes.map(n => n.id));
            const level0Links = data.links.filter(link => 
                level0NodeIds.has(link.source) || level0NodeIds.has(link.target)
            );
            const connectedNodeIds = new Set([
                ...level0NodeIds,
                ...level0Links.map(link => level0NodeIds.has(link.source) ? link.target : link.source)
            ]);

            filteredData = {
                nodes: data.nodes.filter(node => connectedNodeIds.has(node.id)),
                links: level0Links
            };
        }

        // Créer le layout Sankey
        const sankeyLayout = sankey<BaseNode, any>()
            .nodeId(d => d.id)
            .nodeWidth(30)
            .nodePadding(10)
            .extent([[0, 0], [width - margin.left - margin.right, height - margin.top - margin.bottom]]);

        // Appliquer le layout
        const { nodes, links } = sankeyLayout({
            nodes: filteredData.nodes,
            links: filteredData.links
        });

        // Dessiner les liens
        svg.append("g")
            .selectAll("path")
            .data(links)
            .join("path")
            .attr("d", sankeyLinkHorizontal())
            .attr("stroke", "#aaa")
            .attr("stroke-width", d => Math.max(1, d.width || 0))
            .attr("fill", "none")
            .attr("opacity", 0.5)
            .on("mouseover", (event, d: ExtendedSankeyLink) => {
                const source = d.source as ExtendedSankeyNode;
                const target = d.target as ExtendedSankeyNode;
                showTooltip(event, `
                    <div class="sankey-tooltip">
                        <div class="sankey-tooltip-title">
                            ${source.name} → ${target.name}
                        </div>
                        <div class="sankey-tooltip-content">
                            <div>Valeur: ${d.value.toFixed(2)} ${unitOfMeasure}</div>
                        </div>
                    </div>
                `);
            })
            .on("mouseout", hideTooltip);

        // Dessiner les nœuds
        const nodeGroup = svg.append("g")
            .selectAll("g")
            .data(nodes)
            .join("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${d.x0 || 0},${d.y0 || 0})`);

        // Rectangles des nœuds
        nodeGroup.append("rect")
            .attr("width", d => (d.x1 || 0) - (d.x0 || 0))
            .attr("height", d => (d.y1 || 0) - (d.y0 || 0))
            .attr("fill", d => getNodeColor(d.metadata?.energyType))
            .attr("stroke", "#000")
            .attr("cursor", "pointer")
            .on("click", (event, d) => handleNodeClick(d))
            .on("mouseover", (event, d) => {
                showTooltip(event, `
                    <div class="sankey-tooltip">
                        <div class="sankey-tooltip-title">${d.name}</div>
                        <div class="sankey-tooltip-content">
                            <div>Valeur: ${d.value.toFixed(2)} ${unitOfMeasure}</div>
                            <div>Niveau: ${d.metadata?.level}</div>
                        </div>
                    </div>
                `);
            })
            .on("mouseout", hideTooltip);

        // Labels des nœuds
        nodeGroup.append("text")
            .attr("x", d => (d.x0 || 0) < width / 2 ? (d.x1 || 0) - (d.x0 || 0) + 6 : -6)
            .attr("y", d => ((d.y1 || 0) - (d.y0 || 0)) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", d => (d.x0 || 0) < width / 2 ? "start" : "end")
            .text(d => d.name)
            .attr("fill", "#000")
            .attr("font-size", "12px");

        function showTooltip(event: any, content: string) {
            if (!tooltipRef.current) return;
            
            const tooltip = d3.select(tooltipRef.current)
                .style("opacity", 1)
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY - 10}px`);
            
            tooltip.html(content);
        }

        function hideTooltip() {
            if (!tooltipRef.current) return;
            d3.select(tooltipRef.current).style("opacity", 0);
        }

    }, [data, selectedNodeId, unitOfMeasure]);

    const getNodeColor = (energyType?: string) => {
        const colors: { [key: string]: string } = {
            elec: '#1f77b4',
            gaz: '#ff7f0e',
            eau: '#2ca02c',
            air: '#d62728'
        };
        return energyType ? colors[energyType] || '#999' : '#999';
    };

    const handleNodeClick = (node: ExtendedSankeyNode) => {
        // Si on clique sur le nœud déjà sélectionné, on revient à la vue générale
        if (selectedNodeId === node.id) {
            setSelectedNodeId(null);
        } else {
            setSelectedNodeId(node.id);
        }
        
        if (onNodeClick) {
            onNodeClick(node);
        }
    };

    return (
        <div className="apex-sankey-container">
            <div className="sankey-navigation">
                <button 
                    onClick={() => setSelectedNodeId(null)}
                    disabled={!selectedNodeId}
                    className="navigation-button"
                >
                    ← Vue générale
                </button>
                <span className="level-indicator">
                    {selectedNodeId 
                        ? `Détails: ${data.nodes.find(n => n.id === selectedNodeId)?.name || ''}`
                        : 'Vue générale'
                    }
                </span>
            </div>
            <div ref={containerRef} className="sankey-diagram" />
            <div 
                ref={tooltipRef} 
                className="sankey-tooltip" 
                style={{ 
                    position: "absolute",
                    opacity: 0,
                    pointerEvents: "none"
                }} 
            />
        </div>
    );
}; 