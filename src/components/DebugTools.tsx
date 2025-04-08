import React from "react";

interface DebugData {
    timestamp: string;
    hierarchyData: {
        nodes: any[];
        links: any[];
        timeRange?: {
            start: Date;
            end: Date;
        };
    };
    validationStats: {
        total: number;
        valid: number;
        invalid: number;
        withWorkshop: number;
        withoutWorkshop: number;
    };
    nodeStats: {
        sectors: {
            count: number;
            list: Array<{
                id: string;
                name: string;
                machineCount: number;
                workshopCount: number;
                totalConsumption: number;
            }>;
        };
        workshops: {
            count: number;
            list: Array<{
                id: string;
                name: string;
                sector: string;
                machineCount: number;
                totalConsumption: number;
            }>;
        };
        machines: {
            count: number;
            byEnergy: {
                [key: string]: number;  // Comptage par type d'énergie
            };
            bySector: {
                [key: string]: number;  // Comptage par secteur
            };
            byWorkshop: {
                [key: string]: number;  // Comptage par atelier
            };
        };
    };
    linkStats: {
        total: number;
        sectorToWorkshop: number;
        workshopToMachine: number;
        sectorToMachine: number;
        orphanedLinks: string[];  // Liens avec source ou target manquant
    };
    errors: Array<{
        type: string;
        message: string;
        details?: any;
    }>;
    warnings: Array<{
        type: string;
        message: string;
        details?: any;
    }>;
    performance: {
        startTime: number;
        endTime: number;
        duration: number;
        nodeProcessingTime: number;
        linkProcessingTime: number;
    };
}

interface DebugToolsProps {
    data: DebugData;
}

export const DebugTools: React.FC<DebugToolsProps> = ({ data }) => {
    const downloadLogs = () => {
        // Formater les données pour une meilleure lisibilité
        const formattedData = {
            ...data,
            summary: {
                timestamp: new Date().toLocaleString(),
                totalNodes: data.hierarchyData.nodes.length,
                totalLinks: data.hierarchyData.links.length,
                validationRate: `${((data.validationStats.valid / data.validationStats.total) * 100).toFixed(2)}%`,
                workshopAttachmentRate: `${((data.validationStats.withWorkshop / data.validationStats.valid) * 100).toFixed(2)}%`,
                processingTime: `${data.performance?.duration.toFixed(2)}ms`
            }
        };

        const logContent = JSON.stringify(formattedData, null, 2);
        const blob = new Blob([logContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sankey-debug-${new Date().toISOString()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="sankey-debug-tools">
            <button 
                onClick={downloadLogs}
                className="sankey-debug-button"
                title="Télécharger les logs de debug"
            >
                📥 Debug Logs
            </button>
        </div>
    );
}; 