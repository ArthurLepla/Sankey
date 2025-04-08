import React, { useRef, useEffect } from "react";
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import { ExtendedNode, ExtendedLink } from "../../types/SankeyTypes";
import { COLORS } from "../../utils/constants";

interface SankeyChartProps {
    nodes: ExtendedNode[];
    links: any[];
    width: number;
    height: number;
    margin: { top: number; right: number; bottom: number; left: number };
    onNodeClick: (node: ExtendedNode) => void;
    unitOfMeasure?: string;
}

export const SankeyChart: React.FC<SankeyChartProps> = ({
    nodes,
    links,
    width,
    height,
    margin,
    onNodeClick,
    unitOfMeasure = 'kWh'
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!svgRef.current || !tooltipRef.current || width === 0) {
            return;
        }

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        // Fonctions pour le tooltip
        const showTooltip = (event: MouseEvent, content: string) => {
            const tooltip = d3.select(tooltipRef.current);
            tooltip
                .style("opacity", 1)
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY - 10}px`)
                .html(content);
        };

        const hideTooltip = () => {
            d3.select(tooltipRef.current)
                .style("opacity", 0);
        };

        try {
            // Validation des données
            const hasInvalidNodes = nodes.some(node => 
                typeof node.value !== 'number' ||
                isNaN(node.value)
            );

            if (hasInvalidNodes) {
                console.error("[DEBUG] Invalid node values detected");
                return;
            }

            // Création du layout Sankey
            const sankeyGenerator = sankey<ExtendedNode, ExtendedLink>()
                .nodeWidth(30)
                .nodePadding(20)
                .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]]);

            // Préparation des données
            const sankeyData = {
                nodes: nodes.map(node => ({
                    ...node,
                    sourceLinks: [],
                    targetLinks: []
                })),
                links: links.map(link => ({
                    ...link,
                    width: 0,
                    y0: 0,
                    y1: 0
                }))
            };

            const { nodes: sankeyNodes, links: sankeyLinks } = sankeyGenerator(sankeyData);

            // Vérification des positions calculées
            const hasInvalidPositions = sankeyNodes.some(
                node => isNaN(node.x0!) || isNaN(node.x1!) || isNaN(node.y0!) || isNaN(node.y1!)
            );

            if (hasInvalidPositions) {
                console.error("[DEBUG] Invalid node positions detected");
                return;
            }

            // Dessiner les liens
            svg.append("g")
                .selectAll("path")
                .data(sankeyLinks)
                .join("path")
                .attr("class", "sankey-link")
                .attr("d", sankeyLinkHorizontal())
                .attr("stroke-width", d => Math.max(1, d.width || 0))
                .attr("stroke", COLORS.link)
                .attr("fill", "none")
                .on("mouseover", (event, d) => {
                    showTooltip(event, `
                        <div class="sankey-tooltip-title">
                            ${d.source.name} → ${d.target.name}
                        </div>
                        <div class="sankey-tooltip-content">
                            <div class="sankey-tooltip-row">
                                <span class="sankey-tooltip-label">Source:</span>
                                <span class="sankey-tooltip-value">${d.source.name}</span>
                            </div>
                            <div class="sankey-tooltip-row">
                                <span class="sankey-tooltip-label">Destination:</span>
                                <span class="sankey-tooltip-value">${d.target.name}</span>
                            </div>
                            <div class="sankey-tooltip-row">
                                <span class="sankey-tooltip-label">Valeur:</span>
                                <span class="sankey-tooltip-value">${d.value.toFixed(2)} ${unitOfMeasure}</span>
                            </div>
                        </div>
                    `);
                })
                .on("mouseout", hideTooltip);

            // Dessiner les nœuds
            const nodeGroup = svg.append("g")
                .selectAll("g")
                .data(sankeyNodes)
                .join("g")
                .attr("class", "sankey-node");

            nodeGroup.append("rect")
                .attr("x", d => d.x0!)
                .attr("y", d => d.y0!)
                .attr("height", d => Math.max(1, d.y1! - d.y0!))
                .attr("width", d => d.x1! - d.x0!)
                .attr("fill", d => COLORS[d.category])
                .on("mouseover", (event, d) => {
                    showTooltip(event, `
                        <div class="sankey-tooltip-title">${d.name}</div>
                        <div class="sankey-tooltip-content">
                            <div class="sankey-tooltip-row">
                                <span class="sankey-tooltip-label">Catégorie:</span>
                                <span class="sankey-tooltip-value">${d.category}</span>
                            </div>
                            <div class="sankey-tooltip-row">
                                <span class="sankey-tooltip-label">Valeur:</span>
                                <span class="sankey-tooltip-value">${d.value.toFixed(2)} ${unitOfMeasure}</span>
                            </div>
                        </div>
                    `);
                })
                .on("mouseout", hideTooltip)
                .on("click", (event, d) => onNodeClick(d));

            // Labels
            nodeGroup.append("text")
                .attr("class", "sankey-label")
                .attr("x", d => d.x0! < width / 2 ? d.x1! + 6 : d.x0! - 6)
                .attr("y", d => (d.y0! + d.y1!) / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", d => d.x0! < width / 2 ? "start" : "end")
                .text(d => `${d.name} (${d.value.toFixed(2)} ${unitOfMeasure})`);

        } catch (error) {
            console.error("[DEBUG] Error rendering Sankey diagram:", error);
        }
    }, [nodes, links, width, height, margin, onNodeClick, unitOfMeasure]);

    return (
        <div className="sankey-chart" style={{ position: "relative" }}>
            <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
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