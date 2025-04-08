import { ReactElement, createElement } from "react";
import { AdvancedSankeyV2PreviewProps } from "../typings/AdvancedSankeyV2Props";

export function preview(props: AdvancedSankeyV2PreviewProps): ReactElement {
    return createElement("div", {
        style: {
            border: "1px dashed #ccc",
            height: "400px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "14px"
        }
    }, [
        createElement("div", null, "Advanced Sankey Diagram Preview"),
        createElement("div", null, props.title || "Diagramme Sankey")
    ]);
}

export function getPreviewCss(): string {
    return require("./ui/AdvancedSankeyV2.css");
}
