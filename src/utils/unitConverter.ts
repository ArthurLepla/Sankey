interface ConvertedValue {
    value: number;
    unit: string;
}

interface PriceData {
    prixElec?: number;
    prixGaz?: number;
    prixEau?: number;
    prixAir?: number;
    dateDebut?: Date;
    dateFin?: Date;
}

interface CostValue {
    value: number;
    originalValue: number;
    originalUnit: string;
    cost: number;
    currency: string;
}

export function formatEnergyValue(value: number, energyType: string, customUnit?: string): ConvertedValue {
    // Si une unité personnalisée est spécifiée, l'utiliser sans conversion
    if (customUnit) {
        return { value, unit: customUnit };
    }

    // Pour l'électricité, conversion automatique kWh -> MWh -> GWh
    if (energyType === 'elec') {
        if (value >= 1_000_000) {
            return {
                value: value / 1_000_000,
                unit: 'GWh'
            };
        } else if (value >= 1_000) {
            return {
                value: value / 1_000,
                unit: 'MWh'
            };
        }
        return {
            value,
            unit: 'kWh'
        };
    }

    // Pour les autres types d'énergie, utiliser m³
    return {
        value,
        unit: 'm³'
    };
}

export function formatValue(value: number): string {
    // Handle zero values explicitly
    if (value === 0) {
        return "0";
    }
    // Formater le nombre avec 2 décimales maximum et supprimer les zéros inutiles
    return Number(value.toFixed(2)).toString();
}

export function calculatePercentage(value: number, total: number): string {
    if (total === 0) return "0%";
    const percentage = (value / total) * 100;
    // Arrondir à 1 décimale
    return `${Number(percentage.toFixed(1))}%`;
}

export function calculateCost(
    value: number,
    energyType: string,
    priceData: PriceData,
    currency: string = "€"
): CostValue | null {
    // Vérifier si nous avons un prix valide pour ce type d'énergie
    let price: number | undefined;
    let originalUnit: string;

    switch (energyType) {
        case "elec":
            price = priceData.prixElec;
            // Convertir en kWh si nécessaire pour le calcul
            if (value >= 1_000_000) {
                value = value * 1_000_000; // GWh to kWh
                originalUnit = "GWh";
            } else if (value >= 1_000) {
                value = value * 1_000; // MWh to kWh
                originalUnit = "MWh";
            } else {
                originalUnit = "kWh";
            }
            break;
        case "gaz":
            price = priceData.prixGaz;
            originalUnit = "m³";
            break;
        case "eau":
            price = priceData.prixEau;
            originalUnit = "m³";
            break;
        case "air":
            price = priceData.prixAir;
            originalUnit = "m³";
            break;
        default:
            return null;
    }

    if (price === undefined) {
        return null;
    }

    const cost = value * price;

    return {
        value: value,
        originalValue: value,
        originalUnit,
        cost,
        currency
    };
}

export function formatCost(cost: number, currency: string = "€"): string {
    return `${Number(cost.toFixed(2)).toLocaleString()} ${currency}`;
} 