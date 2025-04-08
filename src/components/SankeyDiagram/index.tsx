import React, { useRef, useState, useEffect, useMemo } from 'react';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { SankeyProps, SankeyData, ExtendedNode, ExtendedLink } from '../../types/SankeyTypes';
import { SankeyDataService } from '../../services/SankeyDataService';
import { SankeyNode } from './SankeyNode';
import { SankeyLink } from './SankeyLink';
import { SankeyBreadcrumbs } from './SankeyBreadcrumbs';
import './styles.css';

interface SankeyDiagramProps extends SankeyProps {
    selectedNode?: string | null;
    view?: "overview" | "detail";
}

export const SankeyDiagram: React.FC<SankeyDiagramProps> = ({ 
    data,
    nodeWidth = 30,
    nodePadding = 50,
    onNodeClick,
    selectedNode,
    view = "overview"
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [currentLevel, setCurrentLevel] = useState(0);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [navigationPath, setNavigationPath] = useState<Array<{
        id: string;
        name: string;
        level: string;
    }>>([]);
    const [focusedNode, setFocusedNode] = useState<string | null>(null);

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

    // Reset l'état quand on revient à la vue d'ensemble
    useEffect(() => {
        if (view === "overview") {
            setCurrentLevel(0);
            setExpandedNodes(new Set());
            setNavigationPath([]);
            setFocusedNode(null);
        }
    }, [view]);

    const handleNodeClick = (node: ExtendedNode) => {
        if (view === "overview") {
            if (node.metadata?.level === data.levels[currentLevel]?.name) {
                setExpandedNodes(prev => {
                    const newSet = new Set(prev);
                    if (newSet.has(node.id)) {
                        newSet.delete(node.id);
                        // Retirer ce nœud et ses enfants du chemin de navigation
                        setNavigationPath(prev => 
                            prev.filter(item => item.id !== node.id)
                        );
                    } else {
                        newSet.add(node.id);
                        // Ajouter ce nœud au chemin de navigation
                        setNavigationPath(prev => [
                            ...prev,
                            {
                                id: node.id,
                                name: node.name,
                                level: node.metadata?.level || 'Unknown'
                            }
                        ]);
                    }
                    return newSet;
                });
                setFocusedNode(node.id);
            }
        }
        
        if (onNodeClick) {
            onNodeClick(node);
        }
    };

    const handleNavigate = (index: number) => {
        if (index === -1) {
            // Retour à la vue générale
            setCurrentLevel(0);
            setExpandedNodes(new Set());
            setNavigationPath([]);
            setFocusedNode(null);
        } else {
            // Navigation vers un niveau spécifique
            setNavigationPath(prev => prev.slice(0, index + 1));
            setCurrentLevel(index);
            const nodeId = navigationPath[index].id;
            setFocusedNode(nodeId);
            setExpandedNodes(prev => {
                const newSet = new Set(prev);
                navigationPath.slice(0, index + 1).forEach(item => {
                    newSet.add(item.id);
                });
                return newSet;
            });
        }
    };

    const sankeyData = useMemo(() => {
        if (!SankeyDataService.validateData(data)) {
            console.error("Données Sankey invalides");
            return null;
        }

        let filteredData = { ...data };

        if (view === "overview") {
            const visibleNodes = new Set<string>();
            
            data.nodes.forEach(node => {
                if (node.metadata?.level === data.levels[currentLevel]?.name) {
                    visibleNodes.add(node.id);
                }
            });

            expandedNodes.forEach(nodeId => {
                const expandedNode = data.nodes.find(n => n.id === nodeId);
                if (expandedNode) {
                    data.links.forEach(link => {
                        if (link.source === nodeId) {
                            visibleNodes.add(link.target);
                        }
                    });
                }
            });

            filteredData = {
                nodes: data.nodes.filter(node => visibleNodes.has(node.id)),
                links: data.links.filter(link => 
                    visibleNodes.has(link.source) && visibleNodes.has(link.target)
                ),
                levels: data.levels
            };
        } else if (view === "detail" && selectedNode) {
            // Logique existante pour la vue détaillée
            const selectedNodeData = data.nodes.find(n => n.id === selectedNode);
            if (selectedNodeData) {
                const relatedLinks = data.links.filter(link => 
                    link.source === selectedNode || link.target === selectedNode
                );
                const relatedNodeIds = new Set([
                    selectedNode,
                    ...relatedLinks.map(link => link.source),
                    ...relatedLinks.map(link => link.target)
                ]);
                
                filteredData = {
                    nodes: data.nodes.filter(node => relatedNodeIds.has(node.id)),
                    links: relatedLinks,
                    levels: data.levels
                };
            }
        }

        const nodeMap = new Map(filteredData.nodes.map((node, index) => [node.id, index]));
        
        const processedData = {
            nodes: filteredData.nodes.map(node => ({
                ...node,
                index: nodeMap.get(node.id) || 0,
                x0: 0,
                x1: 0,
                y0: 0,
                y1: 0,
                sourceLinks: [],
                targetLinks: []
            })),
            links: filteredData.links.map((link, index) => ({
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
    }, [data, dimensions, nodeWidth, nodePadding, selectedNode, view, currentLevel, expandedNodes]);

    if (!sankeyData) {
        return <div className="sankey-error">Données invalides</div>;
    }

    return (
        <div ref={containerRef} className="sankey-container">
            <SankeyBreadcrumbs
                path={navigationPath}
                onNavigate={handleNavigate}
            />
            
            {view === "overview" && (
                <div className="sankey-navigation">
                    <div className="level-indicator">
                        Niveau : {data.levels[currentLevel]?.name || ""}
                    </div>
                    <div className="navigation-buttons">
                        <button 
                            onClick={() => setCurrentLevel(prev => Math.max(0, prev - 1))}
                            disabled={currentLevel === 0}
                        >
                            ← Niveau précédent
                        </button>
                        <button 
                            onClick={() => setCurrentLevel(prev => Math.min(data.levels.length - 1, prev + 1))}
                            disabled={currentLevel === data.levels.length - 1}
                        >
                            Niveau suivant →
                        </button>
                    </div>
                </div>
            )}

            <svg 
                width={dimensions.width} 
                height={dimensions.height}
                className="sankey-svg"
            >
                <g className="sankey-links">
                    {sankeyData.links.map((link: any, i) => (
                        <SankeyLink
                            key={`${link.source.id}-${link.target.id}-${i}`}
                            link={link}
                            isHighlighted={
                                focusedNode === link.source.id || 
                                focusedNode === link.target.id
                            }
                        />
                    ))}
                </g>
                <g className="sankey-nodes">
                    {sankeyData.nodes.map((node: any) => (
                        <SankeyNode
                            key={node.id}
                            node={node}
                            onClick={() => handleNodeClick(node)}
                            isSelected={node.id === selectedNode}
                            isExpanded={expandedNodes.has(node.id)}
                            isExpandable={
                                view === "overview" && 
                                node.metadata?.level === data.levels[currentLevel]?.name &&
                                sankeyData.links.some((link: any) => 
                                    link.source.id === node.id
                                )
                            }
                            isFocused={node.id === focusedNode}
                            isContextual={
                                !focusedNode || 
                                node.id === focusedNode ||
                                sankeyData.links.some((link: any) => 
                                    (link.source.id === focusedNode && link.target.id === node.id) ||
                                    (link.target.id === focusedNode && link.source.id === node.id)
                                )
                            }
                        />
                    ))}
                </g>
            </svg>
        </div>
    );
}; 