import { ValueStatus, ObjectItem } from "mendix";
import { ExtendedNode, SimplifiedLink, SankeyData, DebugStats } from "../types/SankeyTypes";
import { Big } from "big.js";

export class MendixDataAdapter {
    private debugMode: boolean;
    private debugStats!: DebugStats;
    
    constructor(debugMode: boolean = false) {
        this.debugMode = debugMode;
        this.initDebugStats();
    }

    private initDebugStats(): void {
        this.debugStats = {
            timestamp: new Date().toISOString(),
            hierarchyData: { nodes: [], links: [], levels: [] },
            validationStats: {
                total: 0,
                valid: 0,
                invalid: 0,
                withWorkshop: 0,
                withoutWorkshop: 0
            },
            nodeStats: {
                sectors: { count: 0, list: [] },
                workshops: { count: 0, list: [] },
                machines: {
                    count: 0,
                    byEnergy: {},
                    bySector: {},
                    byWorkshop: {}
                }
            },
            linkStats: {
                total: 0,
                sectorToWorkshop: 0,
                workshopToMachine: 0,
                sectorToMachine: 0,
                orphanedLinks: []
            },
            errors: [],
            warnings: [],
            performance: {
                startTime: Date.now(),
                endTime: 0,
                duration: 0,
                nodeProcessingTime: 0,
                linkProcessingTime: 0
            },
            summary: {
                timestamp: new Date().toLocaleString(),
                totalNodes: 0,
                totalLinks: 0,
                validationRate: "0%",
                workshopAttachmentRate: "0%",
                processingTime: "0ms"
            }
        };
    }

    private async extractNodeData(item: ObjectItem): Promise<ExtendedNode | null> {
        try {
            // Extraire les données de base
            const name = (item as any).name as string;
            const value = (item as any).value as Big;
            const level = (item as any).level as number;
            const category = (item as any).category as string;
            const energyType = (item as any).energyType as string | undefined;

            if (!name || !value || level === undefined) {
                return null;
            }

            return {
                id: item.id,
                name,
                category: category || "default",
                value: Number(value.toString()),
                index: 0,
                x0: 0,
                x1: 0,
                y0: 0,
                y1: 0,
                sourceLinks: [],
                targetLinks: [],
                metadata: {
                    type: category || "default",
                    level,
                    energyType
                }
            };
        } catch (error) {
            if (this.debugMode) {
                console.error("Erreur lors de l'extraction des données du nœud:", error);
            }
            return null;
        }
    }

    private async createLinks(nodes: ExtendedNode[]): Promise<SimplifiedLink[]> {
        const links: SimplifiedLink[] = [];
        const processedLinks = new Set<string>();

        for (let i = 0; i < nodes.length; i++) {
            const sourceNode = nodes[i];
            const sourceLevel = typeof sourceNode.metadata?.level === 'number' ? sourceNode.metadata.level : -1;

            if (sourceLevel === -1) {
                continue;
            }

            // Trouver les nœuds du niveau suivant qui sont liés à ce nœud
            const targetNodes = nodes.filter(node => {
                const nodeLevel = typeof node.metadata?.level === 'number' ? node.metadata.level : -1;
                return nodeLevel === sourceLevel + 1 && node.category === sourceNode.category;
            });

            for (const targetNode of targetNodes) {
                const linkKey = `${sourceNode.id}-${targetNode.id}`;
                if (!processedLinks.has(linkKey)) {
                    links.push({
                        source: sourceNode.id,
                        target: targetNode.id,
                        value: targetNode.value,
                        metadata: {
                            sourceLevel,
                            targetLevel: sourceLevel + 1,
                            isDirectLink: true
                        }
                    });
                    processedLinks.add(linkKey);
                }
            }
        }

        return links;
    }

    async processData(items: ObjectItem[]): Promise<SankeyData> {
        try {
            if (this.debugMode) {
                console.log("Début du traitement des données", {
                    itemsCount: items.length
                });
            }

            // Traiter les nœuds
            const nodes: ExtendedNode[] = [];
            for (const item of items) {
                const node = await this.extractNodeData(item);
                if (node) {
                    nodes.push(node);
                }
            }

            // Créer les liens
            const links = await this.createLinks(nodes);

            // Créer les niveaux
            const levels = Array.from(new Set(nodes.map(node => node.metadata?.level)))
                .filter((level): level is number => typeof level === 'number')
                .sort((a, b) => a - b)
                .map(level => ({
                    level,
                    name: `Niveau ${level}`
                }));

            if (this.debugMode) {
                console.log("Données traitées", {
                    nodesCount: nodes.length,
                    linksCount: links.length,
                    levelsCount: levels.length
                });
            }

            return {
                nodes,
                links,
                levels
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.debugStats.errors.push(errorMessage);
            console.error("Erreur lors du traitement des données", {
                error: errorMessage
            });
            throw error;
        }
    }

    getDebugStats(): DebugStats {
        return this.debugStats;
    }
} 