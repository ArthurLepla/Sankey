import React, { ReactElement, createElement, useEffect, useState, useRef } from "react";
import { ValueStatus } from "mendix";
import * as d3 from "d3";
import { sankey, sankeyLinkHorizontal, sankeyJustify } from "d3-sankey";
import { AdvancedSankeyV2ContainerProps } from "../typings/AdvancedSankeyV2Props";
import { SankeyData, BaseNode, ExtendedNode } from "./types/SankeyTypes";
import "./ui/AdvancedSankeyV2.css";
import { Zap, Flame, Droplet, Wind } from "lucide-react";
import { formatEnergyValue, formatValue, calculatePercentage, calculateCost, formatCost } from "./utils/unitConverter";
import { ListAttributeValue } from "mendix";
import { Big } from "big.js";
import { EditableValue } from "mendix";

// Définition des couleurs pour chaque catégorie
interface ColorScheme {
    [key: string]: string;
}

const COLORS: ColorScheme = {
    Usine: "#2196F3",    // Bleu moderne
    Atelier: "#4CAF50",  // Vert moderne
    Machine: "#FF9800",  // Orange moderne
    link: "#E0E0E0"      // Gris clair moderne
};

// Configuration des énergies
const ENERGY_CONFIG = {
    elec: {
        color: "#38a13c",
        iconColor: "#38a13c",
        titleColor: "#38a13c",
        unit: "kWh",
        icon: Zap,
        title: "Distribution des flux électriques"
    },
    gaz: {
        color: "#F9BE01",
        iconColor: "#F9BE01",
        titleColor: "#F9BE01",
        unit: "m³",
        icon: Flame,
        title: "Distribution des flux de gaz"
    },
    eau: {
        color: "#3293f3",
        iconColor: "#3293f3",
        titleColor: "#3293f3",
        unit: "m³",
        icon: Droplet,
        title: "Distribution des flux d'eau"
    },
    air: {
        color: "#66D8E6",
        iconColor: "#66D8E6",
        titleColor: "#66D8E6",
        unit: "m³",
        icon: Wind,
        title: "Distribution des flux d'air comprimé"
    },
    all: {
        color: "#1a1a1a",
        iconColor: "#1a1a1a",
        titleColor: "#1a1a1a",
        unit: "unité",
        title: "Distribution globale des flux"
    }
} as const;

// Ajouter cette fonction utilitaire en haut du fichier, après les imports
const getAttributeValue = (attribute: ListAttributeValue<Big> | undefined): number | undefined => {
    if (!attribute) {
        console.log("Attribute is undefined");
        return undefined;
    }

    const items = (attribute as any).items;
    if (!items || items.length === 0) {
        console.log("No items in attribute");
        return undefined;
    }

    // Parcourir tous les items pour trouver celui avec des dates valides
    for (const item of items) {
        const value = attribute.get(item);
        if (value?.status === ValueStatus.Available && value.value) {
            console.log("Found value:", value.value.toString());
            return Number(value.value.toString());
        }
    }

    console.log("No valid value found in attribute");
    return undefined;
};

const getPriceForEnergy = (
    priceData: any, 
    selectedEnergy: string, 
    sankeyStartDate?: Date,
    sankeyEndDate?: Date
): { price: number; isValidForPeriod: boolean } | undefined => {
    if (!priceData || !priceData.donneesEntity || !priceData.donneesEntity.items) {
        return undefined;
    }

    // Si pas de dates Sankey spécifiées, on ne peut pas vérifier la validité
    if (!sankeyStartDate || !sankeyEndDate) {
        console.log("Dates Sankey non spécifiées");
        return undefined;
    }

    // Parcourir tous les items de prix
    for (const item of priceData.donneesEntity.items) {
        const dateDebut = priceData.dateDebut?.get(item);
        const dateFin = priceData.dateFin?.get(item);
        
        // Vérifier si les dates sont valides
        if (dateDebut?.status === ValueStatus.Available && 
            dateFin?.status === ValueStatus.Available) {
            
            const startDate = dateDebut.value;
            const endDate = dateFin.value;
            
            // Vérifier si la période de prix couvre toute la période du Sankey
            const isValidPeriod = startDate <= sankeyStartDate && endDate >= sankeyEndDate;
            
            if (isValidPeriod) {
                // Récupérer le prix selon le type d'énergie
                let priceAttribute;
                switch (selectedEnergy) {
                    case "elec":
                        priceAttribute = priceData.prixElec;
                        break;
                    case "gaz":
                        priceAttribute = priceData.prixGaz;
                        break;
                    case "eau":
                        priceAttribute = priceData.prixEau;
                        break;
                    case "air":
                        priceAttribute = priceData.prixAir;
                        break;
                    default:
                        return undefined;
                }

                const price = priceAttribute?.get(item);
                if (price?.status === ValueStatus.Available && price.value) {
                    return {
                        price: Number(price.value.toString()),
                        isValidForPeriod: true
                    };
                }
            } else {
                console.log("Prix non valide pour toute la période:", {
                    prixDebut: startDate,
                    prixFin: endDate,
                    sankeyDebut: sankeyStartDate,
                    sankeyFin: sankeyEndDate
                });
            }
        }
    }

    return undefined;
};

const calculateCostWithDates = (
    value: number, 
    energyType: string, 
    priceData: any, 
    currency: string,
    sankeyStartDate?: Date,
    sankeyEndDate?: Date
): { cost: number; unit: string; isValidForPeriod: boolean } | undefined => {
    if (!priceData) return undefined;

    const priceInfo = getPriceForEnergy(priceData, energyType, sankeyStartDate, sankeyEndDate);
    if (!priceInfo) return undefined;

    const cost = value * priceInfo.price;
    return {
        cost,
        unit: currency,
        isValidForPeriod: priceInfo.isValidForPeriod
    };
};

// Fonction de calcul du padding optimal en fonction du nombre de nœuds
const calculateNodePadding = (nodeCount: number): number => {
    if (nodeCount <= 10) return 35;
    if (nodeCount <= 15) return 30;
    if (nodeCount <= 20) return 25;
    return 20;
};

// Fonction pour déterminer le type d'énergie à partir du nom du nœud
const inferEnergyTypeFromName = (name: string): string | undefined => {
    const nameLower = name.toLowerCase();
    
    // Rechercher des mots-clés dans le nom
    if (nameLower.includes('elec') || nameLower.includes('électr') || nameLower.includes('electr')) {
        return 'elec';
    }
    if (nameLower.includes('gaz') || nameLower.includes('gas')) {
        return 'gaz';
    }
    if (nameLower.includes('eau') || nameLower.includes('water')) {
        return 'eau';
    }
    if (nameLower.includes('air') || nameLower.includes('compress')) {
        return 'air';
    }
    
    return undefined;
};

export function AdvancedSankeyV2(props: AdvancedSankeyV2ContainerProps): ReactElement {
    const [sankeyData, setSankeyData] = useState<SankeyData | null>(null);
    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [view, setView] = useState<"overview" | "detail">("overview");
    type DisplayMode = "consumption" | "cost";
    const [displayMode, setDisplayMode] = useState<DisplayMode>("consumption");
    const isConsumptionMode = (mode: DisplayMode): boolean => mode === "consumption";
    const isCostMode = (mode: DisplayMode): boolean => mode === "cost";
    const [dimensions, setDimensions] = useState({ width: 0, height: 1000 });
    const [hasDataForPeriod, setHasDataForPeriod] = useState<boolean>(true);
    
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Fonction pour filtrer les données en fonction de la vue
    const filterDataForView = (data: SankeyData, selectedNodeId: string | null): SankeyData => {
        // Filtrer d'abord par type d'énergie sélectionné
        let filteredByEnergy = data;
        
        if (props.selectedEnergies !== "all") {
            console.log(`Filtrage pour l'énergie: ${props.selectedEnergies}`);
            
            // Vérifier si des nœuds ont un type d'énergie défini
            const nodesWithEnergyTypes = data.nodes.filter(node => 
                node.metadata?.energyType !== undefined
            );
            
            if (nodesWithEnergyTypes.length === 0) {
                console.log("Aucun nœud n'a de type d'énergie défini, affichage complet");
                // Ne pas filtrer les données
            } else {
                console.log("Application du filtrage avec logique remontante");
                
                // Trouver le nombre de niveaux dans le diagramme
                const levels = [...new Set(data.nodes.map(node => node.metadata?.level))].sort();
                console.log(`Niveaux détectés: ${levels.join(', ')}`);
                
                // 1. Commencer par filtrer les nœuds du niveau le plus bas (généralement les machines)
                // qui correspondent au type d'énergie sélectionné
                const maxLevel = Math.max(...levels.map(l => Number(l)));
                
                // Collecter les ID des nœuds à garder, niveau par niveau, en remontant la hiérarchie
                let nodesToKeep = new Set<string>();
                
                // Logging the energy types and selected filter for debugging
                console.log("Energy filtering debug:", {
                    selectedEnergy: props.selectedEnergies,
                    nodeEnergyTypes: data.nodes
                        .filter(node => node.metadata?.level === maxLevel)
                        .map(node => ({
                            id: node.id,
                            energyType: node.metadata?.energyType,
                            normalized: node.metadata?.energyType?.toLowerCase(),
                            matches: node.metadata?.energyType?.toLowerCase() === props.selectedEnergies.toLowerCase()
                        }))
                });
                
                // Commencer par les nœuds du niveau le plus bas qui correspondent au type d'énergie
                const lowestLevelNodes = data.nodes.filter(node => 
                    node.metadata?.level === maxLevel && 
                    node.metadata?.energyType?.toLowerCase() === props.selectedEnergies.toLowerCase()
                );
                
                lowestLevelNodes.forEach(node => nodesToKeep.add(node.id));
                
                console.log(`Nœuds de niveau ${maxLevel} avec type d'énergie ${props.selectedEnergies}: ${lowestLevelNodes.length}`);
                
                // 2. Remonter la hiérarchie niveau par niveau
                for (let level = maxLevel - 1; level >= 0; level--) {
                    // Pour chaque nœud du niveau actuel
                    const currentLevelNodes = data.nodes.filter(node => 
                        node.metadata?.level === level
                    );
                    
                    // Trouver tous les liens entre ce niveau et les nœuds déjà filtrés
                    currentLevelNodes.forEach(node => {
                        // Un nœud parent est gardé s'il est connecté à au moins un nœud enfant à garder
                        const hasChildrenToKeep = data.links.some(link => {
                            const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
                            const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
                            
                            // Si le nœud est la source et la cible est à garder
                            if (sourceId === node.id && nodesToKeep.has(targetId)) {
                                return true;
                            }
                            
                            return false;
                        });
                        
                        if (hasChildrenToKeep) {
                            nodesToKeep.add(node.id);
                        }
                    });
                    
                    console.log(`Nœuds de niveau ${level} à garder: ${currentLevelNodes.filter(n => nodesToKeep.has(n.id)).length}`);
                }
                
                // 3. Filtrer les nœuds et les liens
                let filteredNodes = data.nodes.filter(node => nodesToKeep.has(node.id));
                
                const filteredLinks = data.links.filter(link => {
                    const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
                    const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
                    
                    return nodesToKeep.has(sourceId) && nodesToKeep.has(targetId);
                });
                
                // 4. Recalculer les valeurs des nœuds
                const recalculatedNodes = filteredNodes.map(node => {
                    // Si c'est un nœud du niveau le plus bas avec le bon type d'énergie, garder sa valeur
                    if (node.metadata?.level === maxLevel && node.metadata?.energyType?.toLowerCase() === props.selectedEnergies.toLowerCase()) {
                        return node;
                    }
                    
                    // Pour les nœuds de niveau supérieur, calculer la somme des valeurs de leurs enfants
                    const childLinks = filteredLinks.filter(link => {
                        const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
                        return sourceId === node.id;
                    });
                    
                    const newValue = childLinks.reduce((sum, link) => sum + link.value, 0);
                    
                    // Si aucun enfant ou somme nulle, chercher récursivement des descendants
                    if (newValue === 0) {
                        // Trouver tous les descendants de ce nœud, quel que soit leur niveau
                        const findAllDescendants = (nodeId: string, visited = new Set<string>()): Set<string> => {
                            if (visited.has(nodeId)) return visited;
                            visited.add(nodeId);
                            
                            const directChildLinks = filteredLinks.filter(link => {
                                const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
                                return sourceId === nodeId;
                            });
                            
                            directChildLinks.forEach(link => {
                                const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
                                findAllDescendants(targetId, visited);
                            });
                            
                            return visited;
                        };
                        
                        const allDescendants = findAllDescendants(node.id);
                        allDescendants.delete(node.id); // Retirer le nœud lui-même
                        
                        // Calculer la somme des valeurs de tous les nœuds de niveau maximal parmi les descendants
                        const lowestLevelDescendants = filteredNodes.filter(n => 
                            allDescendants.has(n.id) && 
                            n.metadata?.level === maxLevel && 
                            n.metadata?.energyType?.toLowerCase() === props.selectedEnergies.toLowerCase()
                        );
                        
                        const descendantsSum = lowestLevelDescendants.reduce((sum, n) => sum + n.value, 0);
                        
                        return {
                            ...node,
                            value: descendantsSum > 0 ? descendantsSum : node.value
                        };
                    }
                    
                    return {
                        ...node,
                        value: newValue > 0 ? newValue : node.value
                    };
                });
                
                filteredByEnergy = {
                    nodes: recalculatedNodes,
                    links: filteredLinks,
                    levels: data.levels
                };
                
                console.log("Données après filtrage par énergie (logique remontante):", {
                    nodesCount: recalculatedNodes.length,
                    linksCount: filteredLinks.length,
                    parentNodes: recalculatedNodes.filter(n => n.metadata?.level !== maxLevel).map(n => ({
                        id: n.id,
                        name: n.name,
                        value: n.value,
                        level: n.metadata?.level
                    }))
                });
            }
        }
        
        // Ensuite, appliquer le filtrage par vue
        if (!selectedNodeId) {
            // Trouver le levelId du niveau 0
            const level0Config = props.hierarchyConfig.find(config => config.levelOrder === 0);
            if (!level0Config) return filteredByEnergy;
            
            const level0Id = level0Config.levelId;
            
            // Vue générale : montrer uniquement les connexions directes avec le niveau 0
            // Mais en utilisant les nœuds et liens déjà filtrés et recalculés
            
            // Avant de filtrer les nœuds pour la vue générale, assurons-nous que les valeurs sont correctement propagées
            const enhancedNodesForGeneralView = [...filteredByEnergy.nodes];
            
            // Commençons par les nœuds de niveau 1 (reliés au niveau 0)
            const level1Nodes = enhancedNodesForGeneralView.filter(node => node.metadata?.level === 1);
            
            level1Nodes.forEach(node => {
                // Trouver tous les nœuds de niveau inférieur connectés à ce nœud de niveau 1
                const childLinks = filteredByEnergy.links.filter(link => {
                    const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
                    return sourceId === node.id;
                });
                
                const childNodeIds = childLinks.map(link => {
                    return typeof link.target === 'string' ? link.target : (link.target as any).id;
                });
                
                // Trouver uniquement les nœuds enfants qui correspondent au filtre d'énergie
                const energyFilteredChildren = enhancedNodesForGeneralView
                    .filter(n => childNodeIds.includes(n.id) && 
                                n.metadata?.energyType?.toLowerCase() === props.selectedEnergies.toLowerCase());
                
                // Recalculer la valeur du nœud de niveau 1 comme la somme des enfants filtrés
                const newValue = energyFilteredChildren.reduce((sum, child) => sum + child.value, 0);
                
                if (newValue > 0) {
                    console.log(`[DEBUG] Recalcul du nœud ${node.id} (niveau 1): ancienne valeur = ${node.value}, nouvelle valeur = ${newValue}, enfants = ${energyFilteredChildren.length}`);
                    node.value = newValue;
                }
            });
            
            // Puis les nœuds de niveau 0 (racines)
            const level0Nodes = enhancedNodesForGeneralView.filter(node => node.metadata?.level === 0);
            
            level0Nodes.forEach(node => {
                // Trouver tous les nœuds de niveau 1 connectés à ce nœud de niveau 0
                const directChildLinks = filteredByEnergy.links.filter(link => {
                    const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
                    return sourceId === node.id;
                });
                
                const level1ChildNodeIds = directChildLinks.map(link => {
                    return typeof link.target === 'string' ? link.target : (link.target as any).id;
                });
                
                // Trouver les nœuds de niveau 1 qui sont déjà recalculés
                const level1Children = enhancedNodesForGeneralView.filter(n => level1ChildNodeIds.includes(n.id));
                
                // Recalculer la valeur du nœud de niveau 0 comme la somme des enfants de niveau 1
                const newValueFromLevel1 = level1Children.reduce((sum, child) => sum + child.value, 0);
                
                // Trouver également les nœuds de niveau 2 directement connectés au niveau 0
                const level2DirectLinks = filteredByEnergy.links.filter(link => {
                    const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
                    const targetNode = enhancedNodesForGeneralView.find(n => n.id === (typeof link.target === 'string' ? link.target : (link.target as any).id));
                    return sourceId === node.id && targetNode && targetNode.metadata?.level === 2;
                });
                
                const level2DirectNodeIds = level2DirectLinks.map(link => {
                    return typeof link.target === 'string' ? link.target : (link.target as any).id;
                });
                
                // Trouver uniquement les nœuds de niveau 2 directement connectés qui correspondent au filtre d'énergie
                const energyFilteredLevel2 = enhancedNodesForGeneralView
                    .filter(n => level2DirectNodeIds.includes(n.id) && 
                                n.metadata?.energyType?.toLowerCase() === props.selectedEnergies.toLowerCase());
                
                const newValueFromLevel2 = energyFilteredLevel2.reduce((sum, child) => sum + child.value, 0);
                
                const totalNewValue = newValueFromLevel1 + newValueFromLevel2;
                
                if (totalNewValue > 0) {
                    console.log(`[DEBUG] Recalcul du nœud ${node.id} (niveau 0): ancienne valeur = ${node.value}, nouvelle valeur = ${totalNewValue}, enfants niveau 1 = ${level1Children.length}, enfants niveau 2 = ${energyFilteredLevel2.length}`);
                    node.value = totalNewValue;
                }
            });
            
            console.log("Nœuds après recalcul pour la vue générale:", enhancedNodesForGeneralView.map(n => ({
                id: n.id,
                level: n.metadata?.level,
                value: n.value,
                energyType: n.metadata?.energyType
            })));
            
            return {
                nodes: enhancedNodesForGeneralView.filter(node => 
                    node.metadata?.level === 0 || // Niveau 0
                    (node.metadata?.level === 1 && filteredByEnergy.links.some(link => 
                        typeof link.source === 'string' && 
                        link.source.startsWith(`${level0Id}_`) && 
                        link.target === node.id)) || // Niveau 1 connecté au niveau 0
                    (node.metadata?.level === 2 && !filteredByEnergy.links.some(link => 
                        link.target === node.id && 
                        typeof link.source === 'string' && 
                        props.hierarchyConfig.find(c => c.levelOrder === 1)?.levelId && 
                        link.source.startsWith(`${props.hierarchyConfig.find(c => c.levelOrder === 1)?.levelId}_`))) // Niveau 2 directement connecté au niveau 0
                ),
                links: filteredByEnergy.links.filter(link => 
                    typeof link.source === 'string' && 
                    link.source.startsWith(`${level0Id}_`)
                ),
                levels: filteredByEnergy.levels
            };
        } else {
            // Vue détaillée : montrer le nœud sélectionné et ses enfants directs
            const nodeLinks = filteredByEnergy.links.filter(link => 
                typeof link.source === 'string' && link.source === selectedNodeId
            );
            
            // Obtenir le niveau maximal du filtre actuel
            const levels = props.hierarchyConfig.map(config => config.levelOrder);
            const maxLevel = Math.max(...levels);
            
            // Filtrer les enfants directs qui correspondent au type d'énergie sélectionné
            const childNodeIds = nodeLinks.map(link => 
                typeof link.target === 'string' ? link.target : (link.target as any).id
            );
            
            // Créer une copie des nœuds pour pouvoir modifier leurs valeurs
            const selectedNode = JSON.parse(JSON.stringify(
                filteredByEnergy.nodes.find(n => n.id === selectedNodeId)
            ));
            
            // Trouver les enfants qui correspondent au type d'énergie sélectionné
            const energyFilteredChildren = filteredByEnergy.nodes.filter(n => 
                childNodeIds.includes(n.id) && 
                (n.metadata?.energyType?.toLowerCase() === props.selectedEnergies.toLowerCase() ||
                 n.metadata?.level !== maxLevel) // Pour les niveaux intermédiaires, on les garde toujours
            );
            
            // Recalculer la valeur du nœud sélectionné comme la somme des enfants filtrés
            if (selectedNode && energyFilteredChildren.length > 0) {
                const newValue = energyFilteredChildren.reduce((sum, child) => sum + child.value, 0);
                
                if (newValue > 0) {
                    console.log(`[DEBUG] Vue détaillée - Recalcul du nœud sélectionné ${selectedNode.id}: ancienne valeur = ${selectedNode.value}, nouvelle valeur = ${newValue}, enfants = ${energyFilteredChildren.length}`);
                    selectedNode.value = newValue;
                }
            }
            
            console.log("Vue détaillée - Nœuds filtrés:", [selectedNode, ...energyFilteredChildren].map(n => ({
                id: n.id,
                level: n.metadata?.level,
                value: n.value,
                energyType: n.metadata?.energyType
            })));
            
            return {
                nodes: [
                    selectedNode,
                    ...energyFilteredChildren
                ],
                links: nodeLinks.filter(link => {
                    const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
                    return energyFilteredChildren.some(node => node.id === targetId);
                }),
                levels: filteredByEnergy.levels
            };
        }
    };

    // Effet pour gérer le redimensionnement
    useEffect(() => {
        if (!containerRef.current) return;

        // Initialisation du SVG avec D3
        const svg = d3.select(svgRef.current);

        const updateDimensions = () => {
            const bbox = containerRef.current?.getBoundingClientRect();
            if (!bbox) return;

            // Augmentation de la hauteur minimale
            const width = Math.max(bbox.width || 800, 800);
            const height = Math.max(bbox.height || 1000, 1000);

            setDimensions({ width, height });

            svg
                .attr("width", width)
                .attr("height", height)
                .attr("viewBox", `0 0 ${width} ${height}`)
                .attr("preserveAspectRatio", "xMidYMid meet");
        };

        // Forcer une mise à jour initiale immédiate
        updateDimensions();

        // Observer les changements de taille avec un délai
        const resizeObserver = new ResizeObserver(() => {
            requestAnimationFrame(updateDimensions);
        });

        resizeObserver.observe(containerRef.current);

        return () => resizeObserver.disconnect();
    }, []);

    // Effet pour le traitement des données
    useEffect(() => {
        try {
            // Vérifier que toutes les entités sont disponibles
            console.log("Configuration de la hiérarchie:", props.hierarchyConfig);
            
            const unavailableEntities = props.hierarchyConfig
                .filter(config => !config.entityPath || config.entityPath.status !== ValueStatus.Available)
                .map(config => ({
                    levelId: config.levelId,
                    status: config.entityPath?.status,
                    itemsCount: config.entityPath?.items?.length
                }));

            if (unavailableEntities.length > 0) {
                console.log("Entités non disponibles:", unavailableEntities);
                return;
            }

            // Vérifier si les dates sont disponibles
            const hasValidDateRange = props.startDate?.status === ValueStatus.Available && 
                                      props.endDate?.status === ValueStatus.Available;
            
            if (hasValidDateRange && props.startDate && props.endDate) {
                console.log("Période sélectionnée:", {
                    startDate: props.startDate.value?.toISOString(),
                    endDate: props.endDate.value?.toISOString()
                });
            } else {
                console.log("Période non définie ou non disponible");
            }

            // Trier les niveaux par ordre
            const sortedLevels = [...props.hierarchyConfig].sort((a, b) => a.levelOrder - b.levelOrder);
            console.log("Niveaux triés:", sortedLevels.map(level => ({
                levelId: level.levelId,
                order: level.levelOrder,
                itemsCount: level.entityPath.items?.length
            })));

            // Traiter les données de chaque niveau
            const nodesMap = new Map<string, ExtendedNode>();
            const links: Array<{ source: string; target: string; value: number }> = [];

            // Variable pour suivre si des données ont été chargées pour la période sélectionnée
            let hasDataForSelectedPeriod = false;
            // Variable pour suivre si des valeurs non nulles ont été trouvées
            let hasNonZeroValues = false;

            // Créer d'abord tous les nœuds pour chaque niveau
            sortedLevels.forEach((levelConfig) => {
                console.log(`[DEBUG] Processing level ${levelConfig.levelId}:`, {
                    levelOrder: levelConfig.levelOrder,
                    itemsCount: levelConfig.entityPath.items?.length,
                    hasEnergyType: levelConfig.energyTypeAttribute !== undefined
                });

                const items = levelConfig.entityPath.items || [];
                items.forEach((item, itemIndex) => {
                    const nameValue = levelConfig.nameAttribute.get(item);
                    const value = levelConfig.valueAttribute.get(item);
                    const level1Parent = levelConfig.parentLevel1NameAttribute?.get(item);
                    const level0Parent = levelConfig.parentLevel0NameAttribute?.get(item);
                    // Récupérer le type d'énergie
                    const energyType = levelConfig.energyTypeAttribute?.get(item);
                    const normalizedEnergyType = energyType?.status === ValueStatus.Available && energyType.value
                        ? energyType.value.toLowerCase()
                        : levelConfig.levelOrder === 2 && typeof nameValue.value === 'string'
                        ? inferEnergyTypeFromName(nameValue.value)
                        : undefined;
                    
                    // Log plus détaillé pour debug
                    console.log(`[DEBUG] Item ${itemIndex} attributes for ${levelConfig.levelId}:`, {
                        name: {
                            status: nameValue?.status,
                            value: nameValue?.value
                        },
                        value: {
                            status: value?.status,
                            value: value?.value?.toString()
                        },
                        energyType: energyType ? {
                            status: energyType.status,
                            value: energyType.value,
                            available: energyType.status === ValueStatus.Available
                        } : 'non défini',
                        level1Parent: level1Parent ? {
                            status: level1Parent.status,
                            value: level1Parent.value
                        } : 'undefined',
                        level0Parent: level0Parent ? {
                            status: level0Parent.status,
                            value: level0Parent.value
                        } : 'undefined'
                    });
                    
                    if (nameValue?.status === ValueStatus.Available && 
                        value?.status === ValueStatus.Available && 
                        typeof nameValue.value === 'string' && 
                        value.value !== undefined && value.value !== null) {
                        
                        const name = nameValue.value;
                        const nodeValue = Number(value.value);
                        
                        if (!isNaN(nodeValue)) {
                            const nodeId = `${levelConfig.levelId}_${name}`;
                            if (!nodesMap.has(nodeId)) {
                                nodesMap.set(nodeId, {
                                    id: nodeId,
                                    name: name,
                                    value: nodeValue,
                                    category: levelConfig.levelId,
                                    index: itemIndex,
                                    x0: 0,
                                    x1: 0,
                                    y0: 0,
                                    y1: 0,
                                    sourceLinks: [],
                                    targetLinks: [],
                                    metadata: {
                                        level: levelConfig.levelOrder,
                                        type: levelConfig.levelId,
                                        energyType: normalizedEnergyType
                                    }
                                });
                                console.log(`[Node Created] ${nodeId} with value: ${nodeValue}`);
                                hasDataForSelectedPeriod = true;
                                // Vérifier si la valeur est supérieure à 0
                                if (nodeValue > 0) {
                                    hasNonZeroValues = true;
                                }
                            } else {
                                // Si le nœud existe déjà, on additionne les valeurs
                                const existingNode = nodesMap.get(nodeId)!;
                                existingNode.value += nodeValue;
                                console.log(`[Node Updated] ${nodeId} value updated to: ${existingNode.value}`);
                                // Vérifier si la valeur totale est supérieure à 0
                                if (existingNode.value > 0) {
                                    hasNonZeroValues = true;
                                }
                            }
                        }
                    }
                });
            });

            // Si on a une plage de dates valide mais aucun nœud trouvé, créer des nœuds avec valeur 0
            if (hasValidDateRange && !hasDataForSelectedPeriod) {
                console.log("[INFO] Aucun nœud trouvé pour la période sélectionnée, création de nœuds vides");
                setHasDataForPeriod(false);
                
                // Créer des nœuds vides pour chaque niveau en se basant sur les noms des niveaux
                sortedLevels.forEach((levelConfig) => {
                    // Créer un nœud vide pour ce niveau
                    const nodeId = `${levelConfig.levelId}_No data`;
                    nodesMap.set(nodeId, {
                        id: nodeId,
                        name: `Pas de données (${levelConfig.levelName})`,
                        value: 0,
                        category: levelConfig.levelId,
                        index: 0,
                        x0: 0,
                        x1: 0,
                        y0: 0,
                        y1: 0,
                        sourceLinks: [],
                        targetLinks: [],
                        metadata: {
                            level: levelConfig.levelOrder,
                            type: levelConfig.levelId,
                            energyType: props.selectedEnergies !== "all" ? props.selectedEnergies : undefined
                        }
                    });
                    
                    // Si ce n'est pas le niveau le plus bas, créer un lien vers le niveau inférieur
                    if (levelConfig.levelOrder < sortedLevels.length - 1) {
                        const nextLevel = sortedLevels.find(l => l.levelOrder === levelConfig.levelOrder + 1);
                        if (nextLevel) {
                            const targetNodeId = `${nextLevel.levelId}_No data`;
                            links.push({
                                source: nodeId,
                                target: targetNodeId,
                                value: 0
                            });
                        }
                    }
                });
            } else if (nodesMap.size > 0) {
                // Ensuite, créer les liens entre les nœuds (seulement si on a des données)
                sortedLevels.forEach((levelConfig) => {
                    const items = levelConfig.entityPath.items || [];
                    items.forEach((item, itemIndex) => {
                        const nameValue = levelConfig.nameAttribute.get(item);
                        const value = levelConfig.valueAttribute.get(item);
                        const level1Parent = levelConfig.parentLevel1NameAttribute?.get(item);
                        const level0Parent = levelConfig.parentLevel0NameAttribute?.get(item);

                        console.log(`[DEBUG] Processing links for level ${levelConfig.levelId}, item ${itemIndex}`);
                        
                        if (nameValue?.status === ValueStatus.Available && 
                            value?.status === ValueStatus.Available && 
                            typeof nameValue.value === 'string') {
                            
                            const nodeId = `${levelConfig.levelId}_${nameValue.value}`;
                            const nodeValue = Number(value.value);

                            // Pour le niveau 2 (machines)
                            if (levelConfig.levelOrder === 2) {
                                console.log(`[DEBUG] Processing machine ${nameValue.value}:`, {
                                    level1Parent: level1Parent ? {
                                        status: level1Parent.status,
                                        value: level1Parent.value,
                                        isAvailable: level1Parent.status === ValueStatus.Available,
                                        isEmpty: level1Parent.value === "empty" || !level1Parent.value
                                    } : 'undefined',
                                    level0Parent: level0Parent ? {
                                        status: level0Parent.status,
                                        value: level0Parent.value,
                                        isAvailable: level0Parent.status === ValueStatus.Available
                                    } : 'undefined'
                                });
                                
                                // Trouver les configurations des niveaux parents
                                const level1Config = sortedLevels.find(c => c.levelOrder === 1);
                                const level0Config = sortedLevels.find(c => c.levelOrder === 0);

                                // Si pas de parent niveau 1 (atelier), connecter directement au niveau 0 (usine)
                                if ((!level1Parent || !levelConfig.parentLevel1NameAttribute || 
                                    level1Parent.status !== ValueStatus.Available || 
                                    !level1Parent.value || level1Parent.value === "empty" || level1Parent.value.trim() === "") && 
                                    level0Parent?.status === ValueStatus.Available && 
                                    level0Config && typeof level0Parent.value === 'string') {
                                    
                                    const parentNodeId = `${level0Config.levelId}_${level0Parent.value}`;
                                    if (nodesMap.has(parentNodeId) && nodesMap.has(nodeId)) {
                                        links.push({
                                            source: parentNodeId,
                                            target: nodeId,
                                            value: nodeValue
                                        });
                                        console.log(`[Link Created] Direct to Usine: ${parentNodeId} -> ${nodeId} (${nodeValue})`);
                                    }
                                }
                                // Sinon, connecter au niveau 1 (atelier)
                                else if (level1Parent?.status === ValueStatus.Available && 
                                        level1Config && 
                                        typeof level1Parent.value === 'string') {
                                    
                                    const parentNodeId = `${level1Config.levelId}_${level1Parent.value}`;
                                    if (nodesMap.has(parentNodeId) && nodesMap.has(nodeId)) {
                                        links.push({
                                            source: parentNodeId,
                                            target: nodeId,
                                            value: nodeValue
                                        });
                                        console.log(`[Link Created] To Atelier: ${parentNodeId} -> ${nodeId} (${nodeValue})`);
                                    }
                                }
                            }
                            // Pour le niveau 1 (ateliers)
                            else if (levelConfig.levelOrder === 1) {
                                const level0Config = sortedLevels.find(c => c.levelOrder === 0);
                                
                                if (level0Parent?.status === ValueStatus.Available && 
                                    level0Config && 
                                    typeof level0Parent.value === 'string') {
                                    
                                    const parentNodeId = `${level0Config.levelId}_${level0Parent.value}`;
                                    if (nodesMap.has(parentNodeId) && nodesMap.has(nodeId)) {
                                        links.push({
                                            source: parentNodeId,
                                            target: nodeId,
                                            value: nodeValue
                                        });
                                        console.log(`[Link Created] Atelier to Usine: ${parentNodeId} -> ${nodeId} (${nodeValue})`);
                                    }
                                }
                            }
                        }
                    });
                });
            }

            // Créer la structure finale des données Sankey
            const sankeyData: SankeyData = {
                nodes: Array.from(nodesMap.values()),
                links: links,
                levels: sortedLevels.map(config => ({
                    level: config.levelOrder,
                    name: config.levelName
                }))
            };

            console.log("Données Sankey initiales avant recalcul:", {
                nodesCount: sankeyData.nodes.length,
                linksCount: sankeyData.links.length
            });
            
            // Si un type d'énergie est sélectionné et différent de "all", recalculer les valeurs des nœuds
            if (props.selectedEnergies !== "all") {
                console.log(`Recalcul des valeurs des nœuds pour le type d'énergie: ${props.selectedEnergies}`);
                
                // 1. Trouver le niveau maximal
                const levels = [...new Set(sankeyData.nodes.map(node => node.metadata?.level))].sort();
                const maxLevel = Math.max(...levels.map(l => Number(l)));
                
                // 2. Filtrer les nœuds du niveau le plus bas par type d'énergie
                const filteredLowestNodes = sankeyData.nodes.filter(node => 
                    node.metadata?.level === maxLevel && 
                    node.metadata?.energyType?.toLowerCase() === props.selectedEnergies.toLowerCase()
                );
                
                console.log(`Nœuds de niveau ${maxLevel} avec énergie ${props.selectedEnergies}: ${filteredLowestNodes.length}`);
                
                // 3. Recalculer les valeurs des nœuds parents niveau par niveau, en remontant
                // Commencer par les nœuds de niveau 1 (si nous avons 3 niveaux)
                if (maxLevel > 1) {
                    const level1Nodes = sankeyData.nodes.filter(node => node.metadata?.level === 1);
                    
                    console.log(`Recalcul des valeurs pour les ${level1Nodes.length} nœuds de niveau 1`);
                    
                    level1Nodes.forEach(node => {
                        // Trouver tous les liens sortants de ce nœud
                        const outgoingLinks = sankeyData.links.filter(link => {
                            const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
                            return sourceId === node.id;
                        });
                        
                        // Trouver les nœuds enfants qui correspondent au type d'énergie
                        const childNodeIds = outgoingLinks.map(link => 
                            typeof link.target === 'string' ? link.target : (link.target as any).id
                        );
                        
                        const energyFilteredChildren = filteredLowestNodes.filter(n => 
                            childNodeIds.includes(n.id)
                        );
                        
                        // Recalculer la valeur de ce nœud comme la somme des enfants filtrés
                        const newValue = energyFilteredChildren.reduce((sum, child) => sum + child.value, 0);
                        
                        if (newValue !== node.value) {
                            console.log(`[RECALCUL] Nœud ${node.id}: ${node.value} -> ${newValue} (${energyFilteredChildren.length} enfants)`);
                            node.value = newValue;
                            
                            // Mettre à jour également les liens entrants vers ce nœud
                            sankeyData.links.forEach(link => {
                                const targetId = typeof link.target === 'string' ? link.target : (link.target as any).id;
                                if (targetId === node.id) {
                                    link.value = newValue;
                                }
                            });
                        }
                    });
                }
                
                // Puis les nœuds de niveau 0
                const level0Nodes = sankeyData.nodes.filter(node => node.metadata?.level === 0);
                
                console.log(`Recalcul des valeurs pour les ${level0Nodes.length} nœuds de niveau 0`);
                
                level0Nodes.forEach(node => {
                    // Trouver tous les liens sortants de ce nœud
                    const outgoingLinks = sankeyData.links.filter(link => {
                        const sourceId = typeof link.source === 'string' ? link.source : (link.source as any).id;
                        return sourceId === node.id;
                    });
                    
                    // Trouver les nœuds enfants qui sont soit des nœuds de niveau 1 recalculés,
                    // soit des nœuds de niveau 2 directement connectés qui correspondent au type d'énergie
                    const childNodeIds = outgoingLinks.map(link => 
                        typeof link.target === 'string' ? link.target : (link.target as any).id
                    );
                    
                    // Cas 1: Nœuds enfants de niveau 1 (déjà recalculés)
                    const level1Children = sankeyData.nodes.filter(n => 
                        childNodeIds.includes(n.id) && n.metadata?.level === 1
                    );
                    
                    // Cas 2: Nœuds enfants de niveau 2 qui correspondent au type d'énergie
                    const level2Children = filteredLowestNodes.filter(n => 
                        childNodeIds.includes(n.id)
                    );
                    
                    // Somme des valeurs 
                    const newValue = level1Children.reduce((sum, child) => sum + child.value, 0) + 
                                    level2Children.reduce((sum, child) => sum + child.value, 0);
                    
                    if (newValue !== node.value) {
                        console.log(`[RECALCUL] Nœud ${node.id}: ${node.value} -> ${newValue} (${level1Children.length} enfants niveau 1, ${level2Children.length} enfants niveau 2)`);
                        node.value = newValue;
                    }
                });
            }
            
            console.log("Données Sankey après recalcul:", {
                nodesCount: sankeyData.nodes.length,
                linksCount: sankeyData.links.length,
                nodesSample: sankeyData.nodes.slice(0, 3).map(n => ({
                    id: n.id,
                    level: n.metadata?.level,
                    value: n.value
                })),
                linksSample: sankeyData.links.slice(0, 3).map(l => {
                    const sourceId = typeof l.source === 'string' ? l.source : (l.source as any).id;
                    const targetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
                    return {
                        source: sourceId,
                        target: targetId,
                        value: l.value
                    };
                })
            });
            
            // Log spécial des nœuds avec type d'énergie
            const nodesWithEnergy = sankeyData.nodes.filter(node => node.metadata?.energyType !== undefined);
            console.log("Nœuds avec type d'énergie inféré :", {
                count: nodesWithEnergy.length,
                nodes: nodesWithEnergy.map(n => ({
                    id: n.id,
                    name: n.name,
                    energyType: n.metadata?.energyType,
                    level: n.metadata?.level
                }))
            });

            // Filtrer les données selon la vue actuelle
            const filteredData = filterDataForView(sankeyData, selectedNode);
            
            console.log("Données filtrées:", {
                selectedEnergy: props.selectedEnergies,
                originalNodesCount: sankeyData.nodes.length,
                filteredNodesCount: filteredData.nodes.length,
                originalLinksCount: sankeyData.links.length,
                filteredLinksCount: filteredData.links.length,
                nodesSample: filteredData.nodes.slice(0, 3).map(n => ({
                    id: n.id,
                    value: n.value,
                    level: n.metadata?.level
                })),
                linksSample: filteredData.links.slice(0, 3).map(l => {
                    const sourceId = typeof l.source === 'string' ? l.source : (l.source as any).id;
                    const targetId = typeof l.target === 'string' ? l.target : (l.target as any).id;
                    return {
                        source: sourceId,
                        target: targetId,
                        value: l.value
                    };
                })
            });
            
            setSankeyData(filteredData);

            // Si on a des nœuds mais toutes les valeurs sont à 0, considérer qu'il n'y a pas de données
            if (hasDataForSelectedPeriod && !hasNonZeroValues) {
                console.log("[INFO] Tous les nœuds ont une valeur de 0, considéré comme absence de données");
                setHasDataForPeriod(false);
            } else if (hasDataForSelectedPeriod) {
                // Remettre l'indicateur à true si on a des données avec des valeurs non nulles
                setHasDataForPeriod(true);
            }

            } catch (error) {
                console.error("Erreur lors du traitement des données:", error);
                setSankeyData(null);
            }
    }, [props.hierarchyConfig, selectedNode, props.startDate, props.endDate, props.selectedEnergies]);

    // Effet pour le rendu D3
    useEffect(() => {
        if (!svgRef.current || !containerRef.current || !tooltipRef.current || !sankeyData) {
            return;
        }

        const { width, height } = dimensions;
        const effectiveWidth = Math.max(width, 800);
        const effectiveHeight = Math.max(height, 600);

        // Fonctions de gestion du tooltip
        const tooltip = tooltipRef.current;
        const showTooltip = (event: MouseEvent, content: string) => {
            if (!tooltip) return;
            tooltip.style.opacity = "1";
            tooltip.innerHTML = content;
            
            const tooltipWidth = tooltip.offsetWidth;
            const tooltipHeight = tooltip.offsetHeight;
            const containerRect = containerRef.current!.getBoundingClientRect();
            
            let left = event.clientX - containerRect.left + 10;
            let top = event.clientY - containerRect.top - tooltipHeight - 10;
            
            if (left + tooltipWidth > containerRect.width) {
                left = event.clientX - containerRect.left - tooltipWidth - 10;
            }
            if (top < 0) {
                top = event.clientY - containerRect.top + 20;
            }
            
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
        };

        const hideTooltip = () => {
            if (!tooltip) return;
            tooltip.style.opacity = "0";
        };

        // Optimisation des marges pour plus d'espace vertical
        const margin = {
            top: Math.max(Math.floor(effectiveHeight * 0.08), 30),    // Réduction de la marge supérieure
            right: Math.max(Math.floor(effectiveWidth * 0.15), 100),
            bottom: Math.max(Math.floor(effectiveHeight * 0.08), 30), // Réduction de la marge inférieure
            left: Math.max(Math.floor(effectiveWidth * 0.15), 100)
        };

        const innerWidth = effectiveWidth - margin.left - margin.right;
        const innerHeight = effectiveHeight - margin.top - margin.bottom;

        // Configuration du SVG avec une transition fluide
        const svg = d3.select(svgRef.current)
            .attr("width", effectiveWidth)
            .attr("height", effectiveHeight)
            .attr("viewBox", `0 0 ${effectiveWidth} ${effectiveHeight}`)
            .attr("preserveAspectRatio", "xMidYMid meet");

        svg.selectAll("*").remove();

        // Ajout d'un gradient pour l'arrière-plan
        const defs = svg.append("defs");
        
        // Gradient pour les liens
        const linkGradient = defs.append("linearGradient")
            .attr("id", "linkGradient")
            .attr("gradientUnits", "userSpaceOnUse");

        linkGradient.append("stop")
            .attr("offset", "0%")
            .attr("stop-color", "#E0E0E0")
            .attr("stop-opacity", 0.8);

        linkGradient.append("stop")
            .attr("offset", "100%")
            .attr("stop-color", "#BDBDBD")
            .attr("stop-opacity", 0.6);

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Calculer les dimensions des nœuds en fonction du nombre de nœuds
        const nodesPerLevel = new Map<number, number>();
        sankeyData.nodes.forEach(node => {
            const level = typeof node.metadata?.level === 'number' ? node.metadata.level : 0;
            nodesPerLevel.set(level, (nodesPerLevel.get(level) || 0) + 1);
        });
        const maxNodesInLevel = Math.max(...Array.from(nodesPerLevel.values()));
        
        // Calcul des dimensions optimales avec une meilleure répartition
        const nodeWidth = Math.max(30, Math.min(50, effectiveWidth * 0.025)); // Réduction de la largeur max des nœuds
        const nodePadding = calculateNodePadding(maxNodesInLevel);

        // Configuration Sankey avec les nouveaux paramètres
        const sankeyGenerator = sankey<ExtendedNode, any>()
            .nodeWidth(nodeWidth)
            .nodePadding(nodePadding)
            .extent([[0, 0], [innerWidth, innerHeight]])
            .nodeAlign(sankeyJustify); // Alignement justifié pour une meilleure répartition

        const processedData = {
            nodes: sankeyData.nodes,
            links: sankeyData.links.map(d => ({
                ...d,
                source: sankeyData.nodes.findIndex(n => n.id === d.source),
                target: sankeyData.nodes.findIndex(n => n.id === d.target),
                value: Math.max(0, d.value)
            })).filter(link => link.source !== -1 && link.target !== -1)
        };

        const { nodes, links } = sankeyGenerator(processedData);

        // Dessiner les liens avec des effets visuels améliorés
        const link = g.append("g")
            .attr("class", "links")
            .attr("fill", "none")
            .selectAll("path")
            .data(links)
            .join("path")
            .attr("class", "sankey-link")
            .attr("d", sankeyLinkHorizontal())
            .attr("stroke", "url(#linkGradient)")
            .attr("stroke-width", d => d.value === 0 ? 0 : Math.max(1, d.width || 0))
            .style("opacity", 0.7)
            .on("mouseover", function(event: MouseEvent, d: any) {
                d3.select(this)
                    .style("opacity", 0.9);
                
                const formattedValue = formatEnergyValue(d.value, props.selectedEnergies);
                const totalValue = sankeyData.nodes.find(n => n.id === d.source.id)?.value || 0;
                const percentage = calculatePercentage(d.value, totalValue);
                
                let tooltipContent = `
                    <div class="sankey-tooltip-title">
                        ${d.source.name} → ${d.target.name}
                    </div>
                    <div class="sankey-tooltip-content">
                        <div class="sankey-tooltip-row">
                            <span class="sankey-tooltip-label">Valeur:</span>
                            <span class="sankey-tooltip-value">${formatValue(formattedValue.value)} ${formattedValue.unit}</span>
                        </div>`;

                if (isCostMode(displayMode) && props.prixConfig.length > 0) {
                    const priceData = props.prixConfig[0];
                    const costValue = calculateCostWithDates(
                        d.value, 
                        props.selectedEnergies, 
                        priceData, 
                        props.currency,
                        props.startDate?.value,
                        props.endDate?.value
                    );

                    if (costValue) {
                        if (costValue.isValidForPeriod) {
                            tooltipContent += `
                                <div class="sankey-tooltip-row">
                                    <span class="sankey-tooltip-label">Coût:</span>
                                    <span class="sankey-tooltip-value">${formatCost(costValue.cost, props.currency)}</span>
                                </div>`;
                        } else {
                            tooltipContent += `
                                <div class="sankey-tooltip-row">
                                    <span class="sankey-tooltip-label">Coût:</span>
                                    <span class="sankey-tooltip-value" style="color: #ff0000;">Prix non valide pour toute la période</span>
                                </div>`;
                        }
                    }
                }

                tooltipContent += `
                        <div class="sankey-tooltip-row">
                            <span class="sankey-tooltip-label">Proportion:</span>
                            <span class="sankey-tooltip-value">${percentage} du flux de ${d.source.name}</span>
                        </div>
                    </div>`;

                showTooltip(event, tooltipContent);
            })
            .on("mouseout", function(event: MouseEvent, d: any) {
                d3.select(this)
                    .style("opacity", 0.7);
                hideTooltip();
            });

        // Dessiner les nœuds avec des effets visuels améliorés
        const node = g.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(nodes)
            .join("g")
            .attr("class", "sankey-node")
            .attr("transform", d => `translate(${d.x0},${d.y0})`);

        // Rectangles des nœuds avec coins arrondis et ombres
        node.append("rect")
            .attr("height", d => d.value === 0 ? 0.1 : Math.max(1, d.y1! - d.y0!))
            .attr("width", d => d.x1! - d.x0!)
            .attr("fill", d => {
                const level = d.metadata?.level;
                switch(level) {
                    case 0: return COLORS.Usine;
                    case 1: return COLORS.Atelier;
                    case 2: return COLORS.Machine;
                    default: return "#999";
                }
            })
            .attr("rx", 4)  // Coins arrondis
            .attr("ry", 4)
            .style("cursor", "pointer")
            .style("filter", "drop-shadow(2px 2px 3px rgba(0,0,0,0.2))")
            .style("transition", "all 0.3s")
            .on("mouseover", function(event: MouseEvent, d: ExtendedNode) {
                d3.select(this)
                    .style("filter", "drop-shadow(3px 3px 4px rgba(0,0,0,0.3))")
                    .style("transform", "scale(1.02)");

                const formattedValue = formatEnergyValue(d.value, props.selectedEnergies);
                
                const parentLink = sankeyData.links.find(link => {
                    if (typeof link.target === 'string') {
                        return link.target === d.id;
                    }
                    const target = link.target as ExtendedNode;
                    return target.id === d.id;
                });
                
                const parentNode = parentLink ? sankeyData.nodes.find(n => {
                    const source = typeof parentLink.source === 'string' ? parentLink.source : (parentLink.source as ExtendedNode).id;
                    return n.id === source;
                }) : null;
                
                const parentValue = parentNode?.value || d.value;
                const percentage = calculatePercentage(d.value, parentValue);

                let tooltipContent = `
                    <div class="sankey-tooltip-title">${d.name}</div>
                    <div class="sankey-tooltip-content">
                        <div class="sankey-tooltip-row">
                            <span class="sankey-tooltip-label">Niveau:</span>
                            <span class="sankey-tooltip-value">${d.category}</span>
                        </div>
                        <div class="sankey-tooltip-row">
                            <span class="sankey-tooltip-label">Valeur:</span>
                            <span class="sankey-tooltip-value">${formatValue(formattedValue.value)} ${formattedValue.unit}</span>
                        </div>`;

                if (isCostMode(displayMode) && props.prixConfig.length > 0) {
                    const priceData = props.prixConfig[0];
                    const costValue = calculateCostWithDates(
                        d.value, 
                        props.selectedEnergies, 
                        priceData, 
                        props.currency,
                        props.startDate?.value,
                        props.endDate?.value
                    );

                    if (costValue) {
                        if (costValue.isValidForPeriod) {
                            tooltipContent += `
                                <div class="sankey-tooltip-row">
                                    <span class="sankey-tooltip-label">Coût:</span>
                                    <span class="sankey-tooltip-value">${formatCost(costValue.cost, props.currency)}</span>
                                </div>`;
                        } else {
                            tooltipContent += `
                                <div class="sankey-tooltip-row">
                                    <span class="sankey-tooltip-label">Coût:</span>
                                    <span class="sankey-tooltip-value" style="color: #ff0000;">Prix non valide pour toute la période</span>
                                </div>`;
                        }
                    }
                }

                tooltipContent += `
                        <div class="sankey-tooltip-row">
                            <span class="sankey-tooltip-label">Proportion:</span>
                            <span class="sankey-tooltip-value">${percentage}${parentNode ? ` de ${parentNode.name}` : ''}</span>
                        </div>
                    </div>`;

                showTooltip(event, tooltipContent);
            })
            .on("mouseout", function() {
                d3.select(this)
                    .style("filter", "drop-shadow(2px 2px 3px rgba(0,0,0,0.2))")
                    .style("transform", "scale(1)");
                hideTooltip();
            })
            .on("click", (event: MouseEvent, d: ExtendedNode) => handleNodeClick(d));

        // Labels des nœuds avec un meilleur style
        const calculateFontSize = (nodeCount: number) => {
            if (nodeCount <= 10) return "20px";
            if (nodeCount <= 15) return "18px";
            if (nodeCount <= 20) return "16px";
            return "14px";
        };

        node.append("text")
            .attr("x", d => {
                // Réduire la distance entre le nœud et le texte
                const padding = 8; // Réduit de 6 à 8 pixels
                return d.x0! < effectiveWidth / 2 ? 
                    -padding : // Pour les nœuds à gauche
                    nodeWidth + padding; // Pour les nœuds à droite
            })
            .attr("y", d => (d.y1! - d.y0!) / 2)
            .attr("dy", "0.35em")
            .attr("text-anchor", d => d.x0! < effectiveWidth / 2 ? "end" : "start")
            .attr("fill", "#424242")
            .attr("font-family", "'Barlow', sans-serif")
            .style("font-size", calculateFontSize(maxNodesInLevel))
            .style("font-weight", "500")
            .style("text-shadow", "1px 1px 2px rgba(255,255,255,0.8)")
            .text(d => {
                const formattedValue = formatEnergyValue(d.value, props.selectedEnergies);
                let label = `${d.name} (${formatValue(formattedValue.value)} ${formattedValue.unit})`;
                
                if (isCostMode(displayMode) && props.prixConfig.length > 0) {
                    const priceData = props.prixConfig[0];
                    const costValue = calculateCostWithDates(
                        d.value, 
                        props.selectedEnergies, 
                        priceData, 
                        props.currency,
                        props.startDate?.value,
                        props.endDate?.value
                    );

                    if (costValue) {
                        label = `${d.name} (${formatCost(costValue.cost, props.currency)})`;
                    }
                }
                
                return label;
            });

        // Ajouter la police Barlow au conteneur SVG pour s'assurer qu'elle est appliquée partout
        svg.style("font-family", "'Barlow', sans-serif");

    }, [sankeyData, dimensions, props.unitOfMeasure, displayMode, props.prixConfig, props.currency]);

    const handleNodeClick = (node: BaseNode) => {
        if (node.id === selectedNode) {
            // Si on clique sur le nœud déjà sélectionné, revenir à la vue générale
            setSelectedNode(null);
        } else if (node.metadata?.level === 1) {
            // Si on clique sur un atelier, montrer ses machines
            setSelectedNode(node.id);
        }
        
        // Exécuter les actions configurées
        const levelConfig = props.hierarchyConfig.find(
            config => config.levelId === node.category
        );

        if (levelConfig?.levelClickedItemAttribute?.status === ValueStatus.Available) {
            levelConfig.levelClickedItemAttribute.setValue(node.name);
        }
        
        if (levelConfig?.levelOnItemClick?.canExecute) {
            levelConfig.levelOnItemClick.execute();
        }
    };

    const getBreadcrumbs = () => {
        if (!sankeyData) return null;

        return (
            <div className="sankey-breadcrumbs">
                <button 
                    className="breadcrumb-home"
                    onClick={() => setSelectedNode(null)}
                >
                    Vue générale
                </button>
                {selectedNode && (
                    <>
                        <span className="breadcrumb-separator">/</span>
                        <button 
                            className="breadcrumb-item"
                            onClick={() => setSelectedNode(null)}
                        >
                            {sankeyData.nodes.find(n => n.id === selectedNode)?.name}
                        </button>
                    </>
                )}
            </div>
        );
    };

    if (!sankeyData) {
        return <div className="sankey-loading">Chargement des données...</div>;
    }

    // Vérifier si des prix valides existent pour la période sélectionnée
    const hasPricesForPeriod = () => {
        if (isCostMode(displayMode) && !props.prixConfig.length) return true;
        const priceData = props.prixConfig[0];
        return sankeyData.nodes.some(node => {
            const costValue = calculateCostWithDates(
                node.value,
                props.selectedEnergies,
                priceData,
                props.currency,
                props.startDate?.value,
                props.endDate?.value
            );
            return costValue?.isValidForPeriod;
        });
    };

    // Si on est en mode coût et qu'il n'y a pas de prix valides, afficher le message
    if (isCostMode(displayMode) && !hasPricesForPeriod()) {
        return (
            <div className="sankey-container" style={{ width: "100%", minWidth: "600px" }}>
                <div className="sankey-header">
                    <div className="sankey-title-section">
                        <div className="sankey-title-container">
                            {props.selectedEnergies !== "all" && (
                                <div className="sankey-energy-icon">
                                    {(() => {
                                        const IconComponent = ENERGY_CONFIG[props.selectedEnergies]?.icon;
                                        return IconComponent && (
                                            <IconComponent 
                                                size={28} 
                                                color={ENERGY_CONFIG[props.selectedEnergies].iconColor}
                                                strokeWidth={2}
                                            />
                                        );
                                    })()}
                                </div>
                            )}
                            <h2 
                                className="sankey-title" 
                                style={{ 
                                    color: props.selectedEnergies !== "all" 
                                        ? ENERGY_CONFIG[props.selectedEnergies].titleColor 
                                        : "#1a1a1a"
                                }}
                            >
                                {props.selectedEnergies !== "all" 
                                    ? ENERGY_CONFIG[props.selectedEnergies].title
                                    : props.title || "Distribution globale des flux"}
                            </h2>
                        </div>
                        <div className="display-mode-switch" style={{
                            display: 'flex',
                            gap: '8px',
                            background: '#f5f5f5',
                            padding: '4px',
                            borderRadius: '8px'
                        }}>
                            <button
                                className={`mode-option ${isConsumptionMode(displayMode) ? "active" : ""}`}
                                onClick={() => setDisplayMode("consumption")}
                                title="Voir les consommations"
                                style={{
                                    padding: '8px 16px',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    background: isConsumptionMode(displayMode) ? '#2196F3' : 'transparent',
                                    color: isConsumptionMode(displayMode) ? 'white' : '#666'
                                }}
                            >
                                Consommation
                            </button>
                            <button
                                className={`mode-option ${isCostMode(displayMode) ? "active" : ""}`}
                                onClick={() => setDisplayMode("cost")}
                                title="Voir les coûts"
                                style={{
                                    padding: '8px 16px',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    background: isCostMode(displayMode) ? '#2196F3' : 'transparent',
                                    color: isCostMode(displayMode) ? 'white' : '#666'
                                }}
                            >
                                Coût
                            </button>
                        </div>
                    </div>
                </div>

                <div className="sankey-no-price-message" style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "40px",
                    textAlign: "center",
                    backgroundColor: "#f5f5f5",
                    borderRadius: "8px",
                    margin: "20px 0"
                }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <h3 style={{
                        color: "#333",
                        marginTop: "20px",
                        marginBottom: "10px"
                    }}>
                        Aucun prix valide pour la période sélectionnée
                    </h3>
                    <p style={{
                        color: "#666",
                        marginBottom: "20px"
                    }}>
                        Les prix ne sont pas configurés ou ne couvrent pas la période du {props.startDate?.value?.toLocaleDateString()} au {props.endDate?.value?.toLocaleDateString()}.
                    </p>
                    {props.onNoPriceClick?.canExecute && (
                        <button 
                            onClick={() => props.onNoPriceClick?.execute()}
                            style={{
                                backgroundColor: "#2196F3",
                                color: "white",
                                border: "none",
                                padding: "10px 20px",
                                borderRadius: "4px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                fontSize: "14px",
                                fontWeight: "500",
                                transition: "background-color 0.2s"
                            }}
                            onMouseOver={e => (e.currentTarget.style.backgroundColor = "#1976D2")}
                            onMouseOut={e => (e.currentTarget.style.backgroundColor = "#2196F3")}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="8"/>
                                <path d="M14.5 9h-2.5a2 2 0 100 4h2a2 2 0 110 4h-4"/>
                                <path d="M12 7v2"/>
                                <path d="M12 15v2"/>
                            </svg>
                            Configurer les prix
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // Vérifier s'il n'y a pas de données pour la période sélectionnée
    if (!hasDataForPeriod) {
        return (
            <div className="sankey-container" style={{ width: "100%", minWidth: "600px" }}>
                <div className="sankey-header">
                    <div className="sankey-title-section">
                        <div className="sankey-title-container">
                            {props.selectedEnergies !== "all" && (
                                <div className="sankey-energy-icon">
                                    {(() => {
                                        const IconComponent = ENERGY_CONFIG[props.selectedEnergies]?.icon;
                                        return IconComponent && (
                                            <IconComponent 
                                                size={28} 
                                                color={ENERGY_CONFIG[props.selectedEnergies].iconColor}
                                                strokeWidth={2}
                                            />
                                        );
                                    })()}
                                </div>
                            )}
                            <h2 
                                className="sankey-title" 
                                style={{ 
                                    color: props.selectedEnergies !== "all" 
                                        ? ENERGY_CONFIG[props.selectedEnergies].titleColor 
                                        : "#1a1a1a"
                                }}
                            >
                                {props.selectedEnergies !== "all" 
                                    ? ENERGY_CONFIG[props.selectedEnergies].title
                                    : props.title || "Distribution globale des flux"}
                            </h2>
                        </div>
                        <div className="display-mode-switch" style={{
                            display: 'flex',
                            gap: '8px',
                            background: '#f5f5f5',
                            padding: '4px',
                            borderRadius: '8px'
                        }}>
                            <button
                                className={`mode-option ${isConsumptionMode(displayMode) ? "active" : ""}`}
                                onClick={() => setDisplayMode("consumption")}
                                title="Voir les consommations"
                                style={{
                                    padding: '8px 16px',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    background: isConsumptionMode(displayMode) ? '#2196F3' : 'transparent',
                                    color: isConsumptionMode(displayMode) ? 'white' : '#666'
                                }}
                            >
                                Consommation
                            </button>
                            <button
                                className={`mode-option ${isCostMode(displayMode) ? "active" : ""}`}
                                onClick={() => setDisplayMode("cost")}
                                title="Voir les coûts"
                                style={{
                                    padding: '8px 16px',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    background: isCostMode(displayMode) ? '#2196F3' : 'transparent',
                                    color: isCostMode(displayMode) ? 'white' : '#666'
                                }}
                            >
                                Coût
                            </button>
                        </div>
                    </div>
                </div>

                <div className="sankey-no-data-message" style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "40px",
                    textAlign: "center",
                    backgroundColor: "#f5f5f5",
                    borderRadius: "8px",
                    margin: "20px 0"
                }}>
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <h3 style={{
                        color: "#333",
                        marginTop: "20px",
                        marginBottom: "10px"
                    }}>
                        Aucune donnée disponible pour la période sélectionnée
                    </h3>
                    <p style={{
                        color: "#666",
                        marginBottom: "20px"
                    }}>
                        Aucune consommation n'a été enregistrée pour la période du {props.startDate?.value?.toLocaleDateString()} au {props.endDate?.value?.toLocaleDateString()}.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="sankey-container" style={{ 
            width: "100%", 
            minWidth: "800px",
            height: "1033px",
            minHeight: "1033px"
        }}>
            <div className="sankey-header">
                <div className="sankey-title-section">
                    <div className="sankey-title-container">
                        {props.selectedEnergies !== "all" && (
                            <div className="sankey-energy-icon">
                                {(() => {
                                    const IconComponent = ENERGY_CONFIG[props.selectedEnergies]?.icon;
                                    return IconComponent && (
                                        <IconComponent 
                                            size={28} 
                                            color={ENERGY_CONFIG[props.selectedEnergies].iconColor}
                                            strokeWidth={2}
                                        />
                                    );
                                })()}
                            </div>
                        )}
                        <h2 
                            className="sankey-title" 
                            style={{ 
                                color: props.selectedEnergies !== "all" 
                                    ? ENERGY_CONFIG[props.selectedEnergies].titleColor 
                                    : "#1a1a1a"
                            }}
                        >
                            {props.selectedEnergies !== "all" 
                                ? ENERGY_CONFIG[props.selectedEnergies].title
                                : props.title || "Distribution globale des flux"}
                        </h2>
                    </div>
                    <div className="display-mode-switch" style={{
                        display: 'flex',
                        gap: '8px',
                        background: '#f5f5f5',
                        padding: '4px',
                        borderRadius: '8px'
                    }}>
                        <button
                            className={`mode-option ${isConsumptionMode(displayMode) ? "active" : ""}`}
                            onClick={() => setDisplayMode("consumption")}
                            title="Voir les consommations"
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                background: isConsumptionMode(displayMode) ? '#2196F3' : 'transparent',
                                color: isConsumptionMode(displayMode) ? 'white' : '#666'
                            }}
                        >
                            Consommation
                        </button>
                        <button
                            className={`mode-option ${isCostMode(displayMode) ? "active" : ""}`}
                            onClick={() => setDisplayMode("cost")}
                            title="Voir les coûts"
                            style={{
                                padding: '8px 16px',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '14px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                background: isCostMode(displayMode) ? '#2196F3' : 'transparent',
                                color: isCostMode(displayMode) ? 'white' : '#666'
                            }}
                        >
                            Coût
                        </button>
                    </div>
                </div>
                {props.startDate?.status === ValueStatus.Available && props.endDate?.status === ValueStatus.Available && (
                    <p className="sankey-subtitle">
                        Période : {props.startDate.value?.toLocaleDateString()} - {props.endDate.value?.toLocaleDateString()}
                    </p>
                )}
            </div>

            {getBreadcrumbs()}

            <div className="sankey-chart" style={{ 
                width: "100%", 
                height: "800px",
                minHeight: "800px",
                position: "relative",
                margin: "20px 0"
            }}>
                <svg 
                    ref={svgRef}
                    style={{ 
                        width: "100%",
                        height: "100%",
                        display: "block",
                        minWidth: "600px"
                    }}
                />
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

            {props.showDebugTools && (
                <div className="debug-info">
                    <h3>Informations de débogage</h3>
                    <pre>
                        {JSON.stringify({
                            nodesCount: sankeyData?.nodes.length || 0,
                            linksCount: sankeyData?.links.length || 0,
                            levels: sankeyData?.levels || [],
                            dimensions
                        }, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
