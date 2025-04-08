import React, { useState, useEffect, useRef, useMemo, createElement } from "react";
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import { ValueStatus } from "mendix";
import { AdvancedSankeyV2ContainerProps } from "../typings/AdvancedSankeyV2Props";
import "./ui/AdvancedSankeyV2.css";

interface SankeyNodeProps {
    id: string;
    name: string;
    category: "secteur" | "atelier" | "machine";
    value: number;
    consommation: number;
}

interface SankeyLinkProps {
    source: number;
    target: number;
    value: number;
}

interface ExtendedNode extends SankeyNodeProps {
    index?: number;
    x0?: number;
    x1?: number;
    y0?: number;
    y1?: number;
    sourceLinks?: any[];
    targetLinks?: any[];
}

interface ExtendedLink {
    source: ExtendedNode;
    target: ExtendedNode;
    value: number;
    width?: number;
    y0?: number;
    y1?: number;
}

interface SimplifiedLink {
    source: number;
    target: number;
    value: number;
}

interface SankeyData {
    nodes: ExtendedNode[];
    links: SimplifiedLink[];
}

// Définition des couleurs pour chaque catégorie
const COLORS = {
    secteur: "#e73c3d",
    atelier: "#50ae4b",
    machine: "#408cbf",
    link: "#e5e8ec"
};

export default function AdvancedSankey(props: AdvancedSankeyV2ContainerProps): React.ReactElement {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [view, setView] = useState<"overview" | "detail">("overview");
    const [dimensions, setDimensions] = useState({ width: 0, height: 600 });

    const DEFAULT_VALUE = 0;

    const sankeyData = useMemo(() => {
        try {
            const nodes: ExtendedNode[] = [];
            const links: SimplifiedLink[] = [];
            const nodeMap = new Map<string, number>();

            if (view === "detail" && selectedNode) {
                console.log("Vue détaillée activée pour:", selectedNode);
                console.log("Status atelierEntity:", props.atelierEntity.status);
                console.log("Nombre d'ateliers:", props.atelierEntity.items?.length);
                
                if (props.atelierEntity.status === ValueStatus.Available && props.atelierEntity.items && props.atelierEntity.items.length > 0) {
                    const selectedAtelier = props.atelierEntity.items.find(atelier => 
                        props.atelierNameAttr.get(atelier).value === selectedNode
                    );
                    
                    console.log("Atelier sélectionné:", selectedAtelier);
                    console.log("Status machineEntity:", props.machineEntity.status);
                    console.log("Nombre de machines:", props.machineEntity.items?.length);
                    
                    if (selectedAtelier) {
                        const atelierName = props.atelierNameAttr.get(selectedAtelier);
                        const atelierConso = props.atelierConsommationAttr.get(selectedAtelier);
                        
                        if (atelierName.status === ValueStatus.Available) {
                            const consommation = atelierConso.status === ValueStatus.Available
                                ? Math.max(0, atelierConso.value?.toNumber() ?? DEFAULT_VALUE)
                                : DEFAULT_VALUE;

                            nodes.push({
                                id: selectedNode,
                                name: selectedNode,
                                category: "atelier" as const,
                                value: DEFAULT_VALUE,
                                consommation
                            });
                            nodeMap.set(selectedNode, 0);

                            if (props.machineEntity.status === ValueStatus.Available && props.machineEntity.items) {
                                let validMachineCount = 0;
                                props.machineEntity.items.forEach((machine) => {
                                    const machineAtelier = props.machineAtelierAttr?.get(machine);
                                    const machineName = props.machineNameAttr.get(machine);
                                    const machineConso = props.machineConsommationAttr.get(machine);

                                    if (
                                        machineAtelier?.status === ValueStatus.Available &&
                                        machineAtelier.value === selectedNode &&
                                        machineName.status === ValueStatus.Available
                                    ) {
                                        const machineId = `machine_${validMachineCount}`;
                                        const consommation = machineConso.status === ValueStatus.Available
                                            ? Math.max(0, machineConso.value?.toNumber() ?? DEFAULT_VALUE)
                                            : DEFAULT_VALUE;

                                        nodes.push({
                                            id: machineId,
                                            name: machineName.value!,
                                            category: "machine" as const,
                                            value: DEFAULT_VALUE,
                                            consommation
                                        });
                                        nodeMap.set(machineId, nodes.length - 1);

                                        links.push({
                                            source: 0,
                                            target: nodes.length - 1,
                                            value: consommation
                                        });
                                        validMachineCount++;
                                    }
                                });
                            }
                        }
                    }
                }
            } else {
                if (props.secteurEntity.status === ValueStatus.Available && props.secteurEntity.items && props.secteurEntity.items.length > 0) {
                    let validSecteurCount = 0;
                    props.secteurEntity.items.forEach(secteur => {
                        const secteurName = props.secteurNameAttr.get(secteur);
                        const secteurConso = props.secteurConsommationAttr.get(secteur);
                        
                        if (secteurName.status === ValueStatus.Available) {
                            const id = secteurName.value!;
                            const consommation = secteurConso.status === ValueStatus.Available
                                ? Math.max(0, secteurConso.value?.toNumber() ?? DEFAULT_VALUE)
                                : DEFAULT_VALUE;

                            nodes.push({
                                id,
                                name: id,
                                category: "secteur" as const,
                                value: DEFAULT_VALUE,
                                consommation
                            });
                            nodeMap.set(id, validSecteurCount);
                            validSecteurCount++;
                        }
                    });

                    if (props.atelierEntity.status === ValueStatus.Available && props.atelierEntity.items) {
                        props.atelierEntity.items.forEach(atelier => {
                            const atelierName = props.atelierNameAttr.get(atelier);
                            const atelierSecteur = props.atelierSecteurAttr.get(atelier);
                            const atelierConso = props.atelierConsommationAttr.get(atelier);

                            if (
                                atelierName.status === ValueStatus.Available &&
                                atelierSecteur.status === ValueStatus.Available &&
                                nodeMap.has(atelierSecteur.value!)
                            ) {
                                const id = atelierName.value!;
                                const secteurId = atelierSecteur.value!;
                                const consommation = atelierConso.status === ValueStatus.Available
                                    ? Math.max(0, atelierConso.value?.toNumber() ?? DEFAULT_VALUE)
                                    : DEFAULT_VALUE;

                                nodes.push({
                                    id,
                                    name: id,
                                    category: "atelier" as const,
                                    value: DEFAULT_VALUE,
                                    consommation
                                });
                                const currentIndex = nodes.length - 1;
                                nodeMap.set(id, currentIndex);

                                links.push({
                                    source: nodeMap.get(secteurId)!,
                                    target: currentIndex,
                                    value: consommation
                                });
                            }
                        });
                    }
                }
            }

            if (nodes.length === 0) {
                return {
                    nodes: [{
                        id: "no-data",
                        name: "Aucune donnée",
                        category: "secteur" as const,
                        value: DEFAULT_VALUE,
                        consommation: DEFAULT_VALUE
                    }],
                    links: []
                };
            }

            return { nodes, links };
        } catch (err) {
            console.error("Erreur lors du traitement des données:", err);
            return {
                nodes: [{
                    id: "error",
                    name: "Erreur de données",
                    category: "secteur" as const,
                    value: DEFAULT_VALUE,
                    consommation: DEFAULT_VALUE
                }],
                links: []
            };
        }
    }, [props, view, selectedNode]);

    useEffect(() => {
        if (!containerRef.current) return;

        const updateDimensions = () => {
            const containerWidth = containerRef.current?.clientWidth || 0;
            setDimensions({
                width: containerWidth,
                height: 600
            });
        };

        // Mise à jour initiale
        updateDimensions();

        // Observer les changements de taille
        const resizeObserver = new ResizeObserver(updateDimensions);
        resizeObserver.observe(containerRef.current);

        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        if (!svgRef.current || !containerRef.current || !tooltipRef.current || dimensions.width === 0) {
            return;
        }

        const { width, height } = dimensions;
        const margin = {
            top: 40,
            right: Math.max(width * 0.15, 100),
            bottom: 40,
            left: Math.max(width * 0.15, 100)
        };

        const svg = d3.select(svgRef.current);
        const tooltip = tooltipRef.current;
        svg.selectAll("*").remove();

        const showTooltip = (event: MouseEvent, content: string) => {
            tooltip.style.opacity = "1";
            tooltip.innerHTML = content;
            
            const tooltipWidth = tooltip.offsetWidth;
            const tooltipHeight = tooltip.offsetHeight;
            const containerRect = containerRef.current!.getBoundingClientRect();
            
            let left = event.clientX - containerRect.left + 10;
            let top = event.clientY - containerRect.top - tooltipHeight - 10;
            
            // Ajustement si le tooltip dépasse à droite
            if (left + tooltipWidth > containerRect.width) {
                left = event.clientX - containerRect.left - tooltipWidth - 10;
            }
            
            // Ajustement si le tooltip dépasse en haut
            if (top < 0) {
                top = event.clientY - containerRect.top + 20;
            }
            
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        };

        const hideTooltip = () => {
            tooltip.style.opacity = "0";
        };

        const sankeyGenerator = sankey<ExtendedNode, ExtendedLink>()
            .nodeWidth(30)
            .nodePadding(20)
            .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]]);

        const processedData = {
            nodes: sankeyData.nodes,
            links: sankeyData.links.map(d => ({
                ...d,
                source: sankeyData.nodes[d.source],
                target: sankeyData.nodes[d.target]
            }))
        };

        const { nodes, links } = sankeyGenerator(processedData);

        // Dessiner les liens
        svg.append("g")
            .selectAll("path")
            .data(links)
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
                            <span class="sankey-tooltip-label">Consommation:</span>
                            <span class="sankey-tooltip-value">${d.value.toFixed(2)} ${props.unitOfMeasure || 'kWh'}</span>
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
                            <span class="sankey-tooltip-label">Consommation:</span>
                            <span class="sankey-tooltip-value">${d.consommation.toFixed(2)} ${props.unitOfMeasure || 'kWh'}</span>
                        </div>
                    </div>
                `);
            })
            .on("mouseout", hideTooltip)
            .on("click", (event, d) => {
                if (d.category === "machine") {
                    // Mettre à jour le nom de la machine cliquée
                    if (props.clickedMachineName && props.clickedMachineName.status === ValueStatus.Available) {
                        props.clickedMachineName.setValue(d.name);
                    }
                    
                    // Exécuter l'action onMachineClick si elle est définie
                    if (props.onMachineClick && props.onMachineClick.canExecute) {
                        props.onMachineClick.execute();
                    }
                } else if (d.category === "atelier") {
                    setSelectedNode(d.id);
                    setView("detail");
                } else if (view === "detail") {
                    setSelectedNode(null);
                    setView("overview");
                }
            });

        // Labels
        nodeGroup.append("text")
            .attr("class", "sankey-label")
            .attr("x", d => d.x0! < width / 2 ? d.x1! + 6 : d.x0! - 6)
            .attr("y", d => (d.y0! + d.y1!) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", d => d.x0! < width / 2 ? "start" : "end")
            .text(d => `${d.name} (${d.consommation.toFixed(2)} ${props.unitOfMeasure || 'kWh'})`);

    }, [sankeyData, dimensions, view, selectedNode, props.unitOfMeasure]);

    return (
        <div ref={containerRef} className="sankey-container">
            <div className="sankey-header">
                <h2 className="sankey-title">{props.title || "Flux d'Énergie"}</h2>
                {props.startDate?.status === ValueStatus.Available && props.endDate?.status === ValueStatus.Available && (
                    <p className="sankey-subtitle">
                        Période : {props.startDate.value?.toLocaleDateString()} - {props.endDate.value?.toLocaleDateString()}
                    </p>
                )}
            </div>

            <div className="sankey-navigation">
                <button
                    className="sankey-back-button"
                    onClick={() => {
                        setSelectedNode(null);
                        setView("overview");
                    }}
                >
                    {view === "detail" ? "← Retour" : "Vue Générale"}
                </button>
                {selectedNode && (
                    <div className="sankey-breadcrumb">
                        <span>Vue Générale / {selectedNode}</span>
                    </div>
                )}
            </div>

            <div className="sankey-chart">
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
        </div>
    );
}
