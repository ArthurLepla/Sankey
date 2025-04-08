import { ListAttributeValue, ReferenceValue } from "mendix";
import { Big } from "big.js";

export interface HierarchyLevelConfig {
    levelName: string;
    entityPath: ReferenceValue;
    nameAttribute: ListAttributeValue<string>;
    valueAttribute: ListAttributeValue<Big>;
    categoryAttribute?: ListAttributeValue<string>;
    energyTypeAttribute?: ListAttributeValue<string>;
} 