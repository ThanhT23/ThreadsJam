import { _decorator, Component, Node, Sprite, SpriteFrame } from "cc";
import { Autotiling, AutotileType, ITileData } from "./Autotiling";
import { LevelDataSO } from "../Data/LevelDataSO";
const { ccclass, property } = _decorator;

/**
 * Enhanced cell data interface that extends the existing ICellData
 */
export interface IEnhancedCellData {
    x: number;
    y: number;
    t: number; // tile index for compatibility
    type: string; // tile type as string for compatibility
    autotileType?: AutotileType; // autotile type enum
    autotileRule?: number; // calculated autotile rule
    variant?: number; // tile variant for visual variety
}

@ccclass("TileEditor")
export class TileEditor extends Component {
    @property(Autotiling)
    autotiling: Autotiling = null!;

    @property(LevelDataSO)
    levelData: LevelDataSO = null!;

    @property(Node)
    tileContainer: Node = null!;

    private tileMap: Map<string, IEnhancedCellData> = new Map();

    protected onLoad() {
        if (!this.tileContainer) {
            this.tileContainer = this.node;
        }
    }

    /**
     * Convert autotile data to enhanced cell data for level saving
     */
    public convertToLevelData(): IEnhancedCellData[] {
        const cells: IEnhancedCellData[] = [];
        const autotileTiles = this.autotiling.exportTileData();

        for (const tile of autotileTiles) {
            const cellData: IEnhancedCellData = {
                x: tile.x,
                y: tile.y,
                t: this.autotileTypeToTileIndex(tile.type),
                type: tile.type.toString(),
                autotileType: tile.type,
                autotileRule: tile.rule,
                variant: this.calculateTileVariant(tile),
            };
            cells.push(cellData);
        }

        return cells;
    }

    /**
     * Load level data and apply autotiling
     */
    public loadFromLevelData(cells: IEnhancedCellData[]): void {
        this.autotiling.clearAllTiles();
        this.tileMap.clear();

        for (const cell of cells) {
            const key = this.getKey(cell.x, cell.y);
            this.tileMap.set(key, cell);

            // Convert cell data to autotile type
            const autotileType =
                this.tileIndexToAutotileType(cell.t) || this.stringToAutotileType(cell.type) || cell.autotileType || AutotileType.GROUND;

            this.autotiling.setTile(cell.x, cell.y, autotileType);
        }
    }

    /**
     * Convert autotile type to tile index for backward compatibility
     */
    private autotileTypeToTileIndex(type: AutotileType): number {
        switch (type) {
            case AutotileType.GROUND:
                return 0;
            case AutotileType.WALL:
                return 1;
            case AutotileType.WATER:
                return 2;
            case AutotileType.SOLID:
                return 3;
            default:
                return 0;
        }
    }

    /**
     * Convert tile index to autotile type
     */
    private tileIndexToAutotileType(index: number): AutotileType | null {
        switch (index) {
            case 0:
                return AutotileType.GROUND;
            case 1:
                return AutotileType.WALL;
            case 2:
                return AutotileType.WATER;
            case 3:
                return AutotileType.SOLID;
            default:
                return null;
        }
    }

    /**
     * Convert string to autotile type
     */
    private stringToAutotileType(typeString: string): AutotileType | null {
        switch (typeString.toLowerCase()) {
            case "ground":
            case "grass":
            case "dirt":
                return AutotileType.GROUND;
            case "wall":
            case "stone":
            case "brick":
                return AutotileType.WALL;
            case "water":
            case "liquid":
                return AutotileType.WATER;
            case "solid":
            case "block":
                return AutotileType.SOLID;
            default:
                return null;
        }
    }

    /**
     * Calculate tile variant for visual variety
     */
    private calculateTileVariant(tile: ITileData): number {
        // Simple hash-based variant calculation
        const hash = (tile.x * 73 + tile.y * 37) % 3;
        return Math.abs(hash);
    }

    /**
     * Get a unique key for tile coordinates
     */
    private getKey(x: number, y: number): string {
        return `${x},${y}`;
    }

    /**
     * Set a tile with enhanced data
     */
    public setEnhancedTile(x: number, y: number, autotileType: AutotileType, variant: number = 0): void {
        const key = this.getKey(x, y);

        const cellData: IEnhancedCellData = {
            x,
            y,
            t: this.autotileTypeToTileIndex(autotileType),
            type: autotileType.toString(),
            autotileType,
            autotileRule: 0, // Will be calculated by autotiling system
            variant,
        };

        this.tileMap.set(key, cellData);
        this.autotiling.setTile(x, y, autotileType);

        // Update the cell data with the calculated rule
        const tileData = this.autotiling.getTile(x, y);
        if (tileData) {
            cellData.autotileRule = tileData.rule;
        }
    }

    /**
     * Remove a tile and its enhanced data
     */
    public removeEnhancedTile(x: number, y: number): void {
        const key = this.getKey(x, y);
        this.tileMap.delete(key);
        this.autotiling.removeTile(x, y);
    }

    /**
     * Get enhanced tile data at specific coordinates
     */
    public getEnhancedTile(x: number, y: number): IEnhancedCellData | undefined {
        const key = this.getKey(x, y);
        return this.tileMap.get(key);
    }

    /**
     * Paint tiles in a brush pattern
     */
    public paintBrush(centerX: number, centerY: number, brushSize: number, autotileType: AutotileType): void {
        const radius = Math.floor(brushSize / 2);

        for (let x = centerX - radius; x <= centerX + radius; x++) {
            for (let y = centerY - radius; y <= centerY + radius; y++) {
                const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
                if (distance <= radius) {
                    this.setEnhancedTile(x, y, autotileType);
                }
            }
        }
    }

    /**
     * Fill an area with tiles using flood fill algorithm
     */
    public floodFill(startX: number, startY: number, targetType: AutotileType, newType: AutotileType): void {
        const visited = new Set<string>();
        const queue: { x: number; y: number }[] = [{ x: startX, y: startY }];

        while (queue.length > 0) {
            const { x, y } = queue.shift()!;
            const key = this.getKey(x, y);

            if (visited.has(key)) continue;
            visited.add(key);

            const currentTile = this.autotiling.getTile(x, y);
            if (!currentTile || currentTile.type !== targetType) continue;

            this.setEnhancedTile(x, y, newType);

            // Add neighbors to queue
            const neighbors = [
                { x: x + 1, y },
                { x: x - 1, y },
                { x, y: y + 1 },
                { x, y: y - 1 },
            ];

            for (const neighbor of neighbors) {
                const neighborKey = this.getKey(neighbor.x, neighbor.y);
                if (!visited.has(neighborKey)) {
                    queue.push(neighbor);
                }
            }
        }
    }

    /**
     * Create a rectangular area of tiles
     */
    public createRectangle(
        startX: number,
        startY: number,
        width: number,
        height: number,
        autotileType: AutotileType,
        filled: boolean = true
    ): void {
        if (filled) {
            this.autotiling.fillRect(startX, startY, width, height, autotileType);
        } else {
            // Draw outline only
            for (let x = startX; x < startX + width; x++) {
                this.setEnhancedTile(x, startY, autotileType); // Top edge
                this.setEnhancedTile(x, startY + height - 1, autotileType); // Bottom edge
            }
            for (let y = startY; y < startY + height; y++) {
                this.setEnhancedTile(startX, y, autotileType); // Left edge
                this.setEnhancedTile(startX + width - 1, y, autotileType); // Right edge
            }
        }
    }

    /**
     * Create a circular area of tiles
     */
    public createCircle(centerX: number, centerY: number, radius: number, autotileType: AutotileType, filled: boolean = true): void {
        for (let x = centerX - radius; x <= centerX + radius; x++) {
            for (let y = centerY - radius; y <= centerY + radius; y++) {
                const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);

                if (filled && distance <= radius) {
                    this.setEnhancedTile(x, y, autotileType);
                } else if (!filled && Math.abs(distance - radius) < 0.7) {
                    this.setEnhancedTile(x, y, autotileType);
                }
            }
        }
    }

    /**
     * Get statistics about the current tile map
     */
    public getTileStatistics(): { [key in AutotileType]: number } {
        const stats = {
            [AutotileType.GROUND]: 0,
            [AutotileType.WALL]: 0,
            [AutotileType.WATER]: 0,
            [AutotileType.SOLID]: 0,
        };

        for (const tile of this.tileMap.values()) {
            if (tile.autotileType) {
                stats[tile.autotileType]++;
            }
        }

        return stats;
    }

    /**
     * Optimize the tile map by removing redundant data
     */
    public optimizeTileMap(): void {
        const autotileTiles = this.autotiling.exportTileData();
        const validKeys = new Set(autotileTiles.map((tile) => this.getKey(tile.x, tile.y)));

        // Remove orphaned enhanced data
        for (const key of this.tileMap.keys()) {
            if (!validKeys.has(key)) {
                this.tileMap.delete(key);
            }
        }
    }

    /**
     * Export data in format compatible with existing level system
     */
    public exportForLevelData(): { part: number; cells: IEnhancedCellData[] } {
        return {
            part: 1, // Default part number
            cells: this.convertToLevelData(),
        };
    }
}
