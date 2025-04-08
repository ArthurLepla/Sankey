import React from 'react';
import { ChevronRight } from 'lucide-react';

interface SankeyBreadcrumbsProps {
    path: Array<{
        id: string;
        name: string;
        level: string;
    }>;
    onNavigate: (index: number) => void;
}

export const SankeyBreadcrumbs: React.FC<SankeyBreadcrumbsProps> = ({ path, onNavigate }) => {
    if (!path.length) return null;

    return (
        <div className="sankey-breadcrumbs">
            <button 
                className="breadcrumb-home"
                onClick={() => onNavigate(-1)}
            >
                Vue générale
            </button>
            {path.map((item, index) => (
                <React.Fragment key={item.id}>
                    <ChevronRight size={16} className="breadcrumb-separator" />
                    <button 
                        className="breadcrumb-item"
                        onClick={() => onNavigate(index)}
                    >
                        {item.name}
                        <span className="breadcrumb-level">({item.level})</span>
                    </button>
                </React.Fragment>
            ))}
        </div>
    );
}; 