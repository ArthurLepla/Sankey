# Documentation du Diagramme Sankey dans Flexible Import

## Vue d'ensemble

Le diagramme Sankey est utilisé pour visualiser la hiérarchie des assets et leurs relations. Il est composé de nœuds (nodes) représentant les assets et de liens (links) représentant les relations entre ces assets.

## Structure des données

### Types de base
```typescript
interface HierarchyNode {
  id: string;
  name: string;
  level: number;
  levelName: string;
  metadata?: {
    energyType?: string;
    level?: string;
    type?: string;
    [key: string]: any;
  };
}

interface HierarchyLink {
  source: string;
  target: string;
  value: number;
}

interface HierarchyLevel {
  level: number;
  name: string;
}

interface FlexibleProcessedData {
  hierarchyData: {
    nodes: HierarchyNode[];
    links: HierarchyLink[];
    levels: HierarchyLevel[];
  };
}
```

## Fonctionnement du Sankey

### 1. Préparation des données

1. Les données sont organisées en niveaux hiérarchiques
2. Chaque nœud a :
   - Un ID unique
   - Un nom
   - Un niveau dans la hiérarchie
   - Des métadonnées optionnelles

### 2. Calcul des positions

1. Les nœuds sont positionnés verticalement selon leur niveau
2. La largeur des liens est fixe (value: 1)
3. Les nœuds sont espacés horizontalement pour éviter les chevauchements

### 3. Rendu visuel

```typescript
// Configuration du Sankey
const sankeyConfig = {
  nodeWidth: 30,
  nodePadding: 50,
  extent: [[1, 1], [width - 1, height - 6]]
};

// Création du layout Sankey
const sankeyLayout = sankey()
  .nodeWidth(sankeyConfig.nodeWidth)
  .nodePadding(sankeyConfig.nodePadding)
  .extent(sankeyConfig.extent);

// Application du layout aux données
const { nodes, links } = sankeyLayout({
  nodes: hierarchyData.nodes.map(d => ({ ...d })),
  links: hierarchyData.links.map(d => ({ ...d }))
});
```

### 4. Gestion des interactions

1. Survol des nœuds :
   - Mise en évidence du nœud
   - Affichage des informations dans une tooltip
   - Mise en évidence des liens connectés

2. Sélection des nœuds :
   - Mise à jour de l'état de sélection
   - Déclenchement des callbacks (ex: mise à jour des formulaires)

## Particularités importantes

### Calcul des liens

1. Les liens sont toujours créés entre des nœuds de niveaux adjacents
2. La valeur (value) des liens est constante pour une visualisation uniforme
3. Les liens sont colorés selon le type d'énergie du nœud source

### Positionnement des nœuds

1. Les nœuds sont alignés verticalement par niveau
2. L'espacement horizontal est calculé pour maximiser la lisibilité
3. Les nœuds peuvent être déplacés verticalement dans leur niveau

### Style et apparence

```css
.sankey-node {
  fill-opacity: 0.8;
  stroke: #000;
  stroke-width: 1px;
}

.sankey-link {
  fill: none;
  stroke-opacity: 0.2;
}

.sankey-link:hover {
  stroke-opacity: 0.5;
}
```

## Bonnes pratiques

1. **Gestion des données** :
   - Toujours vérifier que les IDs sont uniques
   - S'assurer que les liens référencent des nœuds existants
   - Maintenir la cohérence des niveaux

2. **Performance** :
   - Limiter le nombre de nœuds affichés
   - Utiliser des clés React appropriées
   - Éviter les recalculs inutiles du layout

3. **Interactivité** :
   - Gérer les états de survol et de sélection
   - Fournir un feedback visuel clair
   - Maintenir la réactivité de l'interface

## Débogage courant

1. **Problèmes d'affichage** :
   - Vérifier les dimensions du conteneur
   - S'assurer que tous les nœuds ont des niveaux valides
   - Contrôler la cohérence des liens

2. **Problèmes de performance** :
   - Réduire le nombre de nœuds si possible
   - Optimiser les calculs de layout
   - Utiliser la mémoisation pour les calculs coûteux

3. **Problèmes d'interaction** :
   - Vérifier les gestionnaires d'événements
   - S'assurer que les états sont correctement mis à jour
   - Contrôler la propagation des événements

## Exemple d'utilisation

```typescript
// Création du diagramme
const SankeyDiagram: React.FC<{ data: FlexibleProcessedData }> = ({ data }) => {
  const { hierarchyData } = data;
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Mise à jour des dimensions
  useEffect(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDimensions({ width, height });
    }
  }, []);

  // Rendu du diagramme
  return (
    <div ref={containerRef} className="sankey-container">
      <svg width={dimensions.width} height={dimensions.height}>
        {/* Rendu des liens */}
        {links.map(link => (
          <path
            key={`${link.source.id}-${link.target.id}`}
            d={sankeyLinkHorizontal()(link)}
            className="sankey-link"
          />
        ))}
        
        {/* Rendu des nœuds */}
        {nodes.map(node => (
          <g
            key={node.id}
            transform={`translate(${node.x0},${node.y0})`}
            className="sankey-node"
          >
            <rect
              width={node.x1 - node.x0}
              height={node.y1 - node.y0}
            />
            <text
              x={(node.x1 - node.x0) / 2}
              y={(node.y1 - node.y0) / 2}
            >
              {node.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};
```

## Conclusion

Le diagramme Sankey est un outil puissant pour visualiser des hiérarchies complexes. Sa mise en œuvre nécessite une attention particulière à :
1. La structure des données
2. Le calcul des positions
3. La gestion des interactions
4. La performance

Pour un fonctionnement optimal, il est crucial de :
- Maintenir une structure de données cohérente
- Gérer correctement les dimensions et le layout
- Optimiser les performances pour les grands jeux de données
- Fournir une expérience utilisateur fluide et intuitive 