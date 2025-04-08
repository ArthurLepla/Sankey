import { Zap, Droplets, Wind, Factory, Flame } from "lucide-react";
import { EnergyConfigs, ColorScheme } from "../types/SankeyTypes";

export const DEFAULT_VALUE = 0;

export const ENERGY_CONFIG: EnergyConfigs = {
    all: {
        icon: Factory,
        color: "#666666",
        unit: ""
    },
    elec: {
        icon: Zap,
        color: "#38a13c",
        unit: "kWh"
    },
    gaz: {
        icon: Flame,
        color: "#F9BE01",
        unit: "m³"
    },
    eau: {
        icon: Droplets,
        color: "#3293f3",
        unit: "m³"
    },
    air: {
        icon: Wind,
        color: "#66D8E6",
        unit: "m³"
    }
};

export const COLORS: ColorScheme = {
    secteur: "#e73c3d",
    atelier: "#50ae4b",
    machine: "#408cbf",
    link: "#e5e8ec"
}; 