import { _decorator, Component, Node, Sprite, SpriteFrame, Prefab, Vec2, instantiate, UITransform } from "cc";
const { ccclass, property } = _decorator;

/**
 * Enum for different autotile types
 */
export enum AutotileType {
    SOLID = "solid",
    GROUND = "ground",
    WATER = "water",
    WALL = "wall",
}

/**
 * Enum for autotile rules based on neighbor positions
 * Uses bit flags for efficient storage and lookup
 */
export enum AutotileRule {
    NONE = 0,
    TOP = 1,
    RIGHT = 2,
    BOTTOM = 4,
    LEFT = 8,
    TOP_RIGHT = 16,
    BOTTOM_RIGHT = 32,
    BOTTOM_LEFT = 64,
    TOP_LEFT = 128,
}

/**
 * Interface for tile data in the grid
 */
export interface ITileData {
    x: number;
    y: number;
    type: AutotileType;
    rule: number; // Combination of AutotileRule flags
    spriteFrame?: SpriteFrame;
}

/**
 * Interface for autotile configuration
 */
export interface IAutotileConfig {
    type: AutotileType;
    spriteFrames: Map<number, SpriteFrame>; // Maps rule combinations to sprite frames
    defaultSprite?: SpriteFrame;
}

@ccclass("Autotiling")
export class Autotiling extends Component {
    @property(Prefab)
    tilePrefab: Prefab = null!;

    @property({ type: [SpriteFrame], displayName: "Ground Tiles" })
    groundTiles: SpriteFrame[] = [];

    @property({ type: [SpriteFrame], displayName: "Wall Tiles" })
    wallTiles: SpriteFrame[] = [];

    @property({ type: [SpriteFrame], displayName: "Water Tiles" })
    waterTiles: SpriteFrame[] = [];

    @property({ type: [SpriteFrame], displayName: "Solid Tiles" })
    solidTiles: SpriteFrame[] = [];

    @property(Number)
    tileSize: number = 32;

    @property(Number)
    gridWidth: number = 10;

    @property(Number)
    gridHeight: number = 10;

    private tileGrid: Map<string, ITileData> = new Map();
    private autotileConfigs: Map<AutotileType, IAutotileConfig> = new Map();
    private tileNodes: Map<string, Node> = new Map();

    protected onLoad() {
        this.initializeAutotileConfigs();
    }

    /**
     * Initialize autotile configurations with sprite frames
     */
    private initializeAutotileConfigs(): void {
        // Ground configuration
        if (this.groundTiles.length >= 47) {
            this.autotileConfigs.set(AutotileType.GROUND, {
                type: AutotileType.GROUND,
                spriteFrames: this.createAutotileMapping(this.groundTiles),
                defaultSprite: this.groundTiles[0],
            });
        }

        // Wall configuration
        if (this.wallTiles.length >= 47) {
            this.autotileConfigs.set(AutotileType.WALL, {
                type: AutotileType.WALL,
                spriteFrames: this.createAutotileMapping(this.wallTiles),
                defaultSprite: this.wallTiles[0],
            });
        }

        // Water configuration
        if (this.waterTiles.length >= 47) {
            this.autotileConfigs.set(AutotileType.WATER, {
                type: AutotileType.WATER,
                spriteFrames: this.createAutotileMapping(this.waterTiles),
                defaultSprite: this.waterTiles[0],
            });
        }

        // Solid configuration
        if (this.solidTiles.length >= 47) {
            this.autotileConfigs.set(AutotileType.SOLID, {
                type: AutotileType.SOLID,
                spriteFrames: this.createAutotileMapping(this.solidTiles),
                defaultSprite: this.solidTiles[0],
            });
        }
    }

    /**
     * Create mapping from autotile rules to sprite frames
     * Following the standard 47-tile autotile format
     */
    private createAutotileMapping(sprites: SpriteFrame[]): Map<number, SpriteFrame> {
        const mapping = new Map<number, SpriteFrame>();

        // Standard autotile mapping (47 tiles)
        const autotileMap: { [key: number]: number } = {
            // Single tile
            0: 0,

            // Edges (4 tiles)
            [AutotileRule.TOP]: 1,
            [AutotileRule.RIGHT]: 2,
            [AutotileRule.BOTTOM]: 3,
            [AutotileRule.LEFT]: 4,

            // Corners (4 tiles)
            [AutotileRule.TOP | AutotileRule.RIGHT]: 5,
            [AutotileRule.RIGHT | AutotileRule.BOTTOM]: 6,
            [AutotileRule.BOTTOM | AutotileRule.LEFT]: 7,
            [AutotileRule.LEFT | AutotileRule.TOP]: 8,

            // T-junctions (4 tiles)
            [AutotileRule.TOP | AutotileRule.RIGHT | AutotileRule.BOTTOM]: 9,
            [AutotileRule.RIGHT | AutotileRule.BOTTOM | AutotileRule.LEFT]: 10,
            [AutotileRule.BOTTOM | AutotileRule.LEFT | AutotileRule.TOP]: 11,
            [AutotileRule.LEFT | AutotileRule.TOP | AutotileRule.RIGHT]: 12,

            // Cross (1 tile)
            [AutotileRule.TOP | AutotileRule.RIGHT | AutotileRule.BOTTOM | AutotileRule.LEFT]: 13,

            // Inner corners (4 tiles)
            [AutotileRule.TOP | AutotileRule.RIGHT | AutotileRule.BOTTOM | AutotileRule.LEFT | AutotileRule.TOP_LEFT]: 14,
            [AutotileRule.TOP | AutotileRule.RIGHT | AutotileRule.BOTTOM | AutotileRule.LEFT | AutotileRule.TOP_RIGHT]: 15,
            [AutotileRule.TOP | AutotileRule.RIGHT | AutotileRule.BOTTOM | AutotileRule.LEFT | AutotileRule.BOTTOM_RIGHT]: 16,
            [AutotileRule.TOP | AutotileRule.RIGHT | AutotileRule.BOTTOM | AutotileRule.LEFT | AutotileRule.BOTTOM_LEFT]: 17,

            // Opposite inner corners (6 tiles)
            [AutotileRule.TOP |
            AutotileRule.RIGHT |
            AutotileRule.BOTTOM |
            AutotileRule.LEFT |
            AutotileRule.TOP_LEFT |
            AutotileRule.BOTTOM_RIGHT]: 18,
            [AutotileRule.TOP |
            AutotileRule.RIGHT |
            AutotileRule.BOTTOM |
            AutotileRule.LEFT |
            AutotileRule.TOP_RIGHT |
            AutotileRule.BOTTOM_LEFT]: 19,

            // More complex combinations...
            // Add more mappings as needed for your specific tileset
        };

        // Apply the mapping
        for (const rule in autotileMap) {
            if (autotileMap.hasOwnProperty(rule)) {
                const ruleNum = parseInt(rule);
                const spriteIndex = autotileMap[ruleNum];
                if (sprites[spriteIndex]) {
                    mapping.set(ruleNum, sprites[spriteIndex]);
                }
            }
        }

        return mapping;
    }

    /**
     * Set a tile at specific grid coordinates
     */
    public setTile(x: number, y: number, type: AutotileType): void {
        const key = this.getGridKey(x, y);

        // Remove existing tile if present
        this.removeTile(x, y);

        // Create new tile data
        const tileData: ITileData = {
            x,
            y,
            type,
            rule: 0,
        };

        this.tileGrid.set(key, tileData);

        // Update this tile and its neighbors
        this.updateTileAndNeighbors(x, y);
    }

    /**
     * Remove a tile at specific grid coordinates
     */
    public removeTile(x: number, y: number): void {
        const key = this.getGridKey(x, y);
        const tileData = this.tileGrid.get(key);

        if (tileData) {
            // Remove tile node
            const tileNode = this.tileNodes.get(key);
            if (tileNode) {
                tileNode.destroy();
                this.tileNodes.delete(key);
            }

            // Remove tile data
            this.tileGrid.delete(key);

            // Update neighbors
            this.updateNeighbors(x, y);
        }
    }

    /**
     * Update a tile and all its neighbors
     */
    private updateTileAndNeighbors(x: number, y: number): void {
        // Update the tile itself
        this.updateTile(x, y);

        // Update all 8 neighbors
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                this.updateTile(x + dx, y + dy);
            }
        }
    }

    /**
     * Update only the neighbors of a tile
     */
    private updateNeighbors(x: number, y: number): void {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                this.updateTile(x + dx, y + dy);
            }
        }
    }

    /**
     * Update a single tile's autotile rule and visual representation
     */
    private updateTile(x: number, y: number): void {
        const key = this.getGridKey(x, y);
        const tileData = this.tileGrid.get(key);

        if (!tileData) return;

        // Calculate autotile rule
        tileData.rule = this.calculateAutotileRule(x, y, tileData.type);

        // Update visual representation
        this.updateTileVisual(tileData);
    }

    /**
     * Calculate the autotile rule for a tile based on its neighbors
     */
    private calculateAutotileRule(x: number, y: number, type: AutotileType): number {
        let rule = 0;

        // Check 8 neighbors
        const neighbors = [
            { dx: 0, dy: 1, flag: AutotileRule.TOP },
            { dx: 1, dy: 0, flag: AutotileRule.RIGHT },
            { dx: 0, dy: -1, flag: AutotileRule.BOTTOM },
            { dx: -1, dy: 0, flag: AutotileRule.LEFT },
            { dx: 1, dy: 1, flag: AutotileRule.TOP_RIGHT },
            { dx: 1, dy: -1, flag: AutotileRule.BOTTOM_RIGHT },
            { dx: -1, dy: -1, flag: AutotileRule.BOTTOM_LEFT },
            { dx: -1, dy: 1, flag: AutotileRule.TOP_LEFT },
        ];

        for (const neighbor of neighbors) {
            const neighborKey = this.getGridKey(x + neighbor.dx, y + neighbor.dy);
            const neighborTile = this.tileGrid.get(neighborKey);

            // Check if neighbor exists and is of the same type
            if (neighborTile && neighborTile.type === type) {
                rule |= neighbor.flag;
            }
        }

        return rule;
    }

    /**
     * Update the visual representation of a tile
     */
    private updateTileVisual(tileData: ITileData): void {
        const key = this.getGridKey(tileData.x, tileData.y);
        let tileNode = this.tileNodes.get(key);

        // Create tile node if it doesn't exist
        if (!tileNode) {
            if (!this.tilePrefab) return;

            tileNode = instantiate(this.tilePrefab);
            tileNode.parent = this.node;
            this.tileNodes.set(key, tileNode);
        }

        // Position the tile
        const worldPos = this.gridToWorldPosition(tileData.x, tileData.y);
        tileNode.setPosition(worldPos.x, worldPos.y, 0);

        // Get the sprite component and update it
        const sprite = tileNode.getComponent(Sprite);
        if (sprite) {
            const config = this.autotileConfigs.get(tileData.type);
            if (config) {
                const spriteFrame = config.spriteFrames.get(tileData.rule) || config.defaultSprite;
                if (spriteFrame) {
                    sprite.spriteFrame = spriteFrame;
                    tileData.spriteFrame = spriteFrame;
                }
            }
        }
    }

    /**
     * Convert grid coordinates to world position
     */
    private gridToWorldPosition(gridX: number, gridY: number): Vec2 {
        return new Vec2(gridX * this.tileSize, gridY * this.tileSize);
    }

    /**
     * Convert world position to grid coordinates
     */
    public worldToGridPosition(worldX: number, worldY: number): Vec2 {
        return new Vec2(Math.floor(worldX / this.tileSize), Math.floor(worldY / this.tileSize));
    }

    /**
     * Generate a unique key for grid coordinates
     */
    private getGridKey(x: number, y: number): string {
        return `${x},${y}`;
    }

    /**
     * Get tile data at specific grid coordinates
     */
    public getTile(x: number, y: number): ITileData | undefined {
        const key = this.getGridKey(x, y);
        return this.tileGrid.get(key);
    }

    /**
     * Check if a tile exists at specific grid coordinates
     */
    public hasTile(x: number, y: number): boolean {
        const key = this.getGridKey(x, y);
        return this.tileGrid.has(key);
    }

    /**
     * Clear all tiles
     */
    public clearAllTiles(): void {
        // Destroy all tile nodes
        for (const tileNode of this.tileNodes.values()) {
            tileNode.destroy();
        }

        // Clear data structures
        this.tileGrid.clear();
        this.tileNodes.clear();
    }

    /**
     * Fill a rectangular area with tiles
     */
    public fillRect(startX: number, startY: number, width: number, height: number, type: AutotileType): void {
        for (let x = startX; x < startX + width; x++) {
            for (let y = startY; y < startY + height; y++) {
                this.setTile(x, y, type);
            }
        }
    }

    /**
     * Get all tiles of a specific type
     */
    public getTilesByType(type: AutotileType): ITileData[] {
        const tiles: ITileData[] = [];
        for (const tile of this.tileGrid.values()) {
            if (tile.type === type) {
                tiles.push(tile);
            }
        }
        return tiles;
    }

    /**
     * Export tile data for saving
     */
    public exportTileData(): ITileData[] {
        return Array.from(this.tileGrid.values());
    }

    /**
     * Import tile data for loading
     */
    public importTileData(tiles: ITileData[]): void {
        this.clearAllTiles();

        for (const tile of tiles) {
            this.setTile(tile.x, tile.y, tile.type);
        }
    }
}
