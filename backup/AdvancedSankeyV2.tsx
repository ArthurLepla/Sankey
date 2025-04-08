import React, { useState, useEffect, useRef, useMemo, createElement } from "react";
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal } from "d3-sankey";
import { ValueStatus } from "mendix";
import { AdvancedSankeyV2ContainerProps, SelectedEnergiesEnum } from "../typings/AdvancedSankeyV2Props";
import { Zap, Droplets, Wind, Factory, Flame } from "lucide-react";
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

// Configuration des icônes et couleurs par type d'énergie
const ENERGY_CONFIG = {
    Elec: {
        icon: Zap,
        color: "#38a13c",
        unit: "kWh"
    },
    Gaz: {
        icon: Flame,
        color: "#F9BE01",
        unit: "m³"
    },
    Eau: {
        icon: Droplets,
        color: "#3293f3",
        unit: "m³"
    },
    Air: {
        icon: Wind,
        color: "#66D8E6",
        unit: "m³"
    }
};

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
            // Vérifier que toutes les données nécessaires sont disponibles
            if (props.secteurEntity.status !== ValueStatus.Available || 
                props.atelierEntity.status !== ValueStatus.Available || 
                props.machineEntity.status !== ValueStatus.Available) {
                console.log("Waiting for data to be available:", {
                    secteur: props.secteurEntity.status,
                    atelier: props.atelierEntity.status,
                    machine: props.machineEntity.status
                });
                return {
                    nodes: [{
                        id: "loading",
                        name: "Chargement...",
                        category: "secteur" as const,
                        value: DEFAULT_VALUE,
                        consommation: DEFAULT_VALUE
                    }],
                    links: []
                };
            }

            const nodes: ExtendedNode[] = [];
            const links: SimplifiedLink[] = [];
            const nodeMap = new Map<string, number>();

            console.log("Début du traitement des données Sankey");
            console.log("Nombre de machines total:", props.machineEntity.items?.length || 0);

            // Fonction pour vérifier si une machine doit être incluse selon son type d'énergie
            const shouldIncludeMachine = (machine: any): boolean => {
                const energieAttr = props.machineEnergieAttr.get(machine);
                const machineName = props.machineNameAttr.get(machine);
                const machineAtelier = props.machineAtelierAttr?.get(machine);
                const machineSecteur = props.machineSecteurAttr?.get(machine);
                
                console.log(`Analyse de la machine:`, {
                    name: machineName.status === ValueStatus.Available ? machineName.value : 'N/A',
                    selectedEnergies: props.selectedEnergies,
                    energie: energieAttr.status === ValueStatus.Available ? energieAttr.value : 'N/A',
                    atelier: machineAtelier?.status === ValueStatus.Available ? machineAtelier.value : 'N/A',
                    secteur: machineSecteur?.status === ValueStatus.Available ? machineSecteur.value : 'N/A'
                });

                if (props.selectedEnergies === "Tous" as SelectedEnergiesEnum) {
                    console.log("Toutes les énergies sont acceptées");
                    return true;
                }
                
                const shouldInclude = energieAttr.status === ValueStatus.Available && 
                                     energieAttr.value === props.selectedEnergies;
                
                console.log(`Résultat de l'inclusion:`, shouldInclude);
                return shouldInclude;
            };

            // Fonction pour générer un ID unique pour un atelier
            const getAtelierId = (atelierName: string | null, secteurName: string): string => {
                return atelierName ? `${atelierName}__${secteurName}` : `NO_ATELIER__${secteurName}`;
            };

            // Fonction pour calculer la consommation totale d'un atelier ou des machines sans atelier d'un secteur
            const calculateAtelierConsommation = (atelierName: string | null, atelierSecteur: string): number => {
                if (!props.machineEntity.items) return 0;
                
                console.log(`Calcul consommation pour ${atelierName ? 'atelier: ' + atelierName : 'machines sans atelier'} dans le secteur ${atelierSecteur}`);
                
                return props.machineEntity.items
                    .filter(machine => {
                        if (!shouldIncludeMachine(machine)) return false;

                        const machineAtelier = props.machineAtelierAttr?.get(machine);
                        const machineSecteur = props.machineSecteurAttr?.get(machine);
                        const machineName = props.machineNameAttr.get(machine);

                        // Si on cherche les machines sans atelier
                        if (atelierName === null) {
                            const hasNoAtelier = !machineAtelier?.value && 
                                               machineSecteur?.status === ValueStatus.Available && 
                                               machineSecteur.value === atelierSecteur;
                            
                            console.log(`Machine sans atelier ${machineName.value}:`, {
                                hasNoAtelier,
                                machineSecteur: machineSecteur?.value
                            });
                            
                            return hasNoAtelier;
                        }

                        // Vérifier que les attributs sont disponibles
                        if (machineAtelier?.status !== ValueStatus.Available || 
                            machineSecteur?.status !== ValueStatus.Available) {
                            return false;
                        }

                        // Vérification de l'atelier et du secteur
                        const matchAtelier = machineAtelier.value === atelierName;
                        const matchSecteur = machineSecteur.value === atelierSecteur;

                        console.log(`Machine ${machineName.value}:`, {
                            machineAtelier: machineAtelier.value,
                            machineSecteur: machineSecteur.value,
                            targetAtelier: atelierName,
                            targetSecteur: atelierSecteur,
                            matchAtelier,
                            matchSecteur
                        });

                        return matchAtelier && matchSecteur;
                    })
                    .reduce((total, machine) => {
                        const machineConso = props.machineConsommationAttr.get(machine);
                        const consommation = machineConso.status === ValueStatus.Available 
                            ? Math.max(0, machineConso.value?.toNumber() ?? DEFAULT_VALUE)
                            : 0;
                        
                        console.log(`Consommation de la machine:`, {
                            machine: props.machineNameAttr.get(machine).value,
                            consommation
                        });
                        
                        return total + consommation;
                    }, 0);
            };

            // Fonction pour calculer la consommation totale d'un secteur
            const calculateSecteurConsommation = (secteurName: string): number => {
                if (!props.atelierEntity.items) return 0;
                
                console.log(`Calcul de la consommation pour le secteur: ${secteurName}`);
                
                // Calculer la consommation des machines avec atelier
                const atelierConsommation = props.atelierEntity.items
                    .filter(atelier => {
                        const atelierSecteur = props.atelierSecteurAttr.get(atelier);
                        return atelierSecteur.status === ValueStatus.Available &&
                               atelierSecteur.value === secteurName;
                    })
                    .reduce((total, atelier) => {
                        const atelierName = props.atelierNameAttr.get(atelier);
                        if (atelierName.status !== ValueStatus.Available) return total;
                        const consommation = calculateAtelierConsommation(atelierName.value!, secteurName);
                        console.log(`Consommation de l'atelier ${atelierName.value}:`, consommation);
                        return total + consommation;
                    }, 0);

                // Calculer la consommation des machines sans atelier
                const noAtelierConsommation = calculateAtelierConsommation(null, secteurName);
                console.log(`Consommation des machines sans atelier du secteur ${secteurName}:`, noAtelierConsommation);

                return atelierConsommation + noAtelierConsommation;
            };

            if (view === "detail" && selectedNode) {
                // Dans la vue détaillée, on affiche soit les machines d'un atelier, soit les machines directement reliées au secteur
                if (props.machineEntity.status === ValueStatus.Available && props.machineEntity.items) {
                    const [selectedAtelierName, selectedSecteurName] = selectedNode.split('__');
                    const isAtelierView = selectedSecteurName !== undefined;

                    // Créer le nœud parent (atelier ou secteur)
                    const parentNode = {
                        id: "parent_root",
                        name: isAtelierView ? `${selectedAtelierName} (${selectedSecteurName})` : selectedNode,
                        category: (isAtelierView ? "atelier" : "secteur") as "atelier" | "secteur",
                        value: DEFAULT_VALUE,
                        consommation: 0
                    };
                    nodes.push(parentNode);
                    nodeMap.set(parentNode.id, 0);

                    let validMachineCount = 0;
                    props.machineEntity.items.forEach((machine) => {
                        if (!shouldIncludeMachine(machine)) return;

                        const machineAtelier = props.machineAtelierAttr?.get(machine);
                        const machineSecteur = props.machineSecteurAttr?.get(machine);
                        const machineName = props.machineNameAttr.get(machine);
                        const machineConso = props.machineConsommationAttr.get(machine);

                        const isNoAtelier = !machineAtelier?.value && machineSecteur?.status === ValueStatus.Available;
                        
                        if (
                            machineSecteur?.status === ValueStatus.Available &&
                            machineName.status === ValueStatus.Available &&
                            ((isAtelierView && machineAtelier?.status === ValueStatus.Available &&
                              machineAtelier.value === selectedAtelierName &&
                              machineSecteur.value === selectedSecteurName) ||
                             (!isAtelierView && isNoAtelier && machineSecteur.value === selectedNode))
                        ) {
                            const machineId = `machine_${validMachineCount}`;
                            const consommation = machineConso.status === ValueStatus.Available
                                ? Math.max(1, machineConso.value?.toNumber() ?? DEFAULT_VALUE)
                                : 1;

                            nodes.push({
                                id: machineId,
                                name: machineName.value!,
                                category: "machine" as const,
                                value: consommation,
                                consommation
                            });
                            nodeMap.set(machineId, nodes.length - 1);

                            links.push({
                                source: 0,
                                target: nodes.length - 1,
                                value: consommation || 1
                            });
                            validMachineCount++;
                            parentNode.consommation += consommation;
                        }
                    });
                }
            } else {
                if (view === "overview") {
                    console.log("Construction de la vue d'ensemble");
                    // Traitement des secteurs
                    if (props.secteurEntity.items) {
                        props.secteurEntity.items.forEach((secteur, index) => {
                            const secteurName = props.secteurNameAttr.get(secteur);
                            if (secteurName.status === ValueStatus.Available) {
                                const consommation = calculateSecteurConsommation(secteurName.value!);
                                console.log(`Ajout du secteur ${secteurName.value} avec consommation:`, consommation);
                                nodes.push({
                                    id: secteurName.value!,
                                    name: secteurName.value!,
                                    category: "secteur",
                                    value: DEFAULT_VALUE,
                                    consommation
                                });
                                nodeMap.set(secteurName.value!, index);
                            }
                        });
                    }

                    // Traitement des ateliers et des machines sans atelier
                    if (props.atelierEntity.items) {
                        let currentIndex = nodes.length;
                        
                        // D'abord, traiter les ateliers normaux
                        props.atelierEntity.items.forEach(atelier => {
                            const atelierName = props.atelierNameAttr.get(atelier);
                            const atelierSecteur = props.atelierSecteurAttr.get(atelier);
                            
                            if (atelierName.status === ValueStatus.Available && 
                                atelierSecteur.status === ValueStatus.Available) {
                                const atelierId = getAtelierId(atelierName.value!, atelierSecteur.value!);
                                const consommation = calculateAtelierConsommation(atelierName.value!, atelierSecteur.value!);
                                
                                if (consommation > 0) {
                                    console.log(`Ajout de l'atelier ${atelierName.value} (${atelierSecteur.value}) avec consommation:`, consommation);
                                    nodes.push({
                                        id: atelierId,
                                        name: atelierName.value!,
                                        category: "atelier",
                                        value: DEFAULT_VALUE,
                                        consommation
                                    });
                                    nodeMap.set(atelierId, currentIndex);
                                    
                                    // Créer le lien avec le secteur
                                    if (nodeMap.has(atelierSecteur.value!)) {
                                        links.push({
                                            source: nodeMap.get(atelierSecteur.value!)!,
                                            target: currentIndex,
                                            value: consommation
                                        });
                                    }
                                    currentIndex++;
                                }
                            }
                        });

                        // Ensuite, traiter les machines sans atelier pour chaque secteur
                        if (props.secteurEntity.items) {
                            props.secteurEntity.items.forEach(secteur => {
                                const secteurName = props.secteurNameAttr.get(secteur);
                                if (secteurName.status === ValueStatus.Available) {
                                    const noAtelierConsommation = calculateAtelierConsommation(null, secteurName.value!);
                                    
                                    if (noAtelierConsommation > 0) {
                                        const noAtelierId = getAtelierId(null, secteurName.value!);
                                        console.log(`Ajout du groupe de machines sans atelier pour le secteur ${secteurName.value} avec consommation:`, noAtelierConsommation);
                                        
                                        nodes.push({
                                            id: noAtelierId,
                                            name: "Machines sans atelier",
                                            category: "atelier",
                                            value: DEFAULT_VALUE,
                                            consommation: noAtelierConsommation
                                        });
                                        nodeMap.set(noAtelierId, currentIndex);
                                        
                                        // Créer le lien avec le secteur
                                        if (nodeMap.has(secteurName.value!)) {
                                            links.push({
                                                source: nodeMap.get(secteurName.value!)!,
                                                target: currentIndex,
                                                value: noAtelierConsommation
                                            });
                                        }
                                        currentIndex++;
                                    }
                                }
                            });
                        }
                    }

                    console.log("Résumé de la construction:", {
                        nombreNoeuds: nodes.length,
                        nombreLiens: links.length,
                        noeuds: nodes.map(n => ({ id: n.id, name: n.name, consommation: n.consommation })),
                        liens: links
                    });
                }
            }

            if (nodes.length === 0) {
                console.warn("No nodes generated from available data");
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

            console.log("Generated Sankey data:", { 
                nodeCount: nodes.length, 
                linkCount: links.length,
                nodes,
                links 
            });

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
        if (!containerRef.current) {
            console.warn("Container ref not available");
            return;
        }

        const updateDimensions = () => {
            const containerWidth = containerRef.current?.clientWidth || 0;
            console.log("Updating dimensions:", { containerWidth });
            
            // S'assurer que nous avons une largeur minimale
            if (containerWidth < 100) {
                console.warn("Container width is too small:", containerWidth);
                return;
            }
            setDimensions({
                width: containerWidth,
                height: 600
            });
        };

        // Mise à jour initiale avec un petit délai pour s'assurer que le conteneur est rendu
        setTimeout(updateDimensions, 0);

        // Observer les changements de taille
        const resizeObserver = new ResizeObserver(() => {
            setTimeout(updateDimensions, 0);
        });
        resizeObserver.observe(containerRef.current);

        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        if (!svgRef.current || !containerRef.current || !tooltipRef.current || dimensions.width === 0) {
            console.warn("Missing required refs or dimensions:", {
                svgRef: !!svgRef.current,
                containerRef: !!containerRef.current,
                tooltipRef: !!tooltipRef.current,
                width: dimensions.width
            });
            return;
        }

        const { width, height } = dimensions;
        const margin = {
            top: 40,
            right: Math.max(width * 0.15, 100),
            bottom: 40,
            left: Math.max(width * 0.15, 100)
        };

        // Vérifier que nous avons un espace suffisant pour le rendu
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        if (innerWidth < 100 || innerHeight < 100) {
            console.warn("Inner dimensions too small:", { innerWidth, innerHeight });
            return;
        }

        const svg = d3.select(svgRef.current);
        const tooltip = tooltipRef.current;
        svg.selectAll("*").remove();

        // Vérifier que nous avons des données valides
        if (!sankeyData.nodes.length || !sankeyData.links.length) {
            console.warn("No data to display:", { nodes: sankeyData.nodes.length, links: sankeyData.links.length });
            return;
        }

        // Log des données pour le debug
        console.log("Sankey data:", {
            nodes: sankeyData.nodes,
            links: sankeyData.links,
            dimensions: { width, height, innerWidth, innerHeight }
        });

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
            .nodeWidth(view === "overview" ? 50 : 30) // Nœuds plus larges en vue d'ensemble
            .nodePadding(20)
            .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]]);

        const processedData = {
            nodes: sankeyData.nodes,
            links: sankeyData.links.map(d => ({
                ...d,
                source: sankeyData.nodes[d.source],
                target: sankeyData.nodes[d.target],
                value: Math.max(1, d.value) // Assurer une valeur minimale pour éviter les NaN
            }))
        };

        // Vérifier que toutes les sources et cibles sont valides
        const invalidLinks = processedData.links.filter(
            link => !link.source || !link.target
        );
        if (invalidLinks.length > 0) {
            console.error("Invalid links found:", invalidLinks);
            return;
        }

        const { nodes, links } = sankeyGenerator(processedData);

        // Vérifier que les positions sont valides
        const hasInvalidPositions = nodes.some(
            node => isNaN(node.x0!) || isNaN(node.x1!) || isNaN(node.y0!) || isNaN(node.y1!)
        );
        if (hasInvalidPositions) {
            console.error("Invalid node positions detected:", nodes);
            return;
        }

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
                    // Pour les machines, toujours exécuter l'action onMachineClick, peu importe la vue
                    if (props.clickedMachineName && props.clickedMachineName.status === ValueStatus.Available) {
                        props.clickedMachineName.setValue(d.name);
                    }
                    
                    if (props.onMachineClick && props.onMachineClick.canExecute) {
                        props.onMachineClick.execute();
                    }
                } else if (d.category === "atelier") {
                    if (view === "detail") {
                        // Si on est déjà en vue détaillée et qu'on clique sur l'atelier, on revient à la vue d'ensemble
                        setSelectedNode(null);
                        setView("overview");
                    } else {
                        // Sinon, on passe en vue détaillée pour l'atelier cliqué
                        setSelectedNode(d.id);
                        setView("detail");
                    }
                } else if (d.category === "secteur") {
                    if (view === "detail") {
                        // Si on est en vue détaillée, on revient à la vue d'ensemble
                        setSelectedNode(null);
                        setView("overview");
                    } else {
                        // En vue d'ensemble, on passe en vue détaillée du secteur pour voir ses machines sans atelier
                        setSelectedNode(d.id);
                        setView("detail");
                    }
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
                {props.selectedEnergies !== "Tous" && ENERGY_CONFIG[props.selectedEnergies] && (
                    <div className="dashboard-icon">
                        {createElement(ENERGY_CONFIG[props.selectedEnergies].icon, {
                            size: 28,
                            color: ENERGY_CONFIG[props.selectedEnergies].color,
                            strokeWidth: 2
                        })}
                    </div>
                )}
                <h2 className="sankey-title">
                    {props.title || "Flux d'Énergie"}
                </h2>
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
