import { AutotileRule, ITileData, AutotileType } from "./Autotiling";

/**
 * Advanced autotiling utilities for pattern detection and optimization
 */
export class AutotileUtils {
    /**
     * Simplified autotile rule calculation using Wang tiles approach
     * Returns a simplified rule index (0-15) for basic 4-directional autotiling
     */
    static calculateSimplifiedRule(hasTop: boolean, hasRight: boolean, hasBottom: boolean, hasLeft: boolean): number {
        let rule = 0;
        if (hasTop) rule |= 1;
        if (hasRight) rule |= 2;
        if (hasBottom) rule |= 4;
        if (hasLeft) rule |= 8;
        return rule;
    }

    /**
     * Calculate blob autotile rule (47-tile system)
     * This is more complex and handles corner cases
     */
    static calculateBlobRule(neighbors: boolean[]): number {
        // neighbors array: [top, right, bottom, left, topRight, bottomRight, bottomLeft, topLeft]
        const [top, right, bottom, left, topRight, bottomRight, bottomLeft, topLeft] = neighbors;

        let rule = 0;
        if (top) rule |= AutotileRule.TOP;
        if (right) rule |= AutotileRule.RIGHT;
        if (bottom) rule |= AutotileRule.BOTTOM;
        if (left) rule |= AutotileRule.LEFT;

        // Only add corner flags if the adjacent edges are also present
        if (topRight && top && right) rule |= AutotileRule.TOP_RIGHT;
        if (bottomRight && bottom && right) rule |= AutotileRule.BOTTOM_RIGHT;
        if (bottomLeft && bottom && left) rule |= AutotileRule.BOTTOM_LEFT;
        if (topLeft && top && left) rule |= AutotileRule.TOP_LEFT;

        return rule;
    }

    /**
     * Convert 8-directional rule to simplified 4-directional rule
     */
    static simplifyRule(fullRule: number): number {
        let simplified = 0;
        if (fullRule & AutotileRule.TOP) simplified |= 1;
        if (fullRule & AutotileRule.RIGHT) simplified |= 2;
        if (fullRule & AutotileRule.BOTTOM) simplified |= 4;
        if (fullRule & AutotileRule.LEFT) simplified |= 8;
        return simplified;
    }

    /**
     * Get tile index for simplified 16-tile autotile set
     */
    static getSimplifiedTileIndex(rule: number): number {
        // Map 4-directional rules to tile indices in a 16-tile set
        const tileMap: { [key: number]: number } = {
            0: 0, // No neighbors
            1: 1, // Top only
            2: 2, // Right only
            3: 3, // Top + Right
            4: 4, // Bottom only
            5: 5, // Top + Bottom
            6: 6, // Right + Bottom
            7: 7, // Top + Right + Bottom
            8: 8, // Left only
            9: 9, // Top + Left
            10: 10, // Right + Left
            11: 11, // Top + Right + Left
            12: 12, // Bottom + Left
            13: 13, // Top + Bottom + Left
            14: 14, // Right + Bottom + Left
            15: 15, // All directions
        };

        return tileMap[rule] || 0;
    }

    /**
     * Detect common patterns in tile arrangements
     */
    static detectPattern(tiles: ITileData[], centerX: number, centerY: number, radius: number = 2): string {
        const patterns = [];

        // Check for rectangular areas
        if (this.isRectangularArea(tiles, centerX, centerY, radius)) {
            patterns.push("rectangular");
        }

        // Check for corridors
        if (this.isCorridor(tiles, centerX, centerY)) {
            patterns.push("corridor");
        }

        // Check for corners
        if (this.isCorner(tiles, centerX, centerY)) {
            patterns.push("corner");
        }

        // Check for isolated tiles
        if (this.isIsolated(tiles, centerX, centerY)) {
            patterns.push("isolated");
        }

        return patterns.join(",") || "unknown";
    }

    private static isRectangularArea(tiles: ITileData[], centerX: number, centerY: number, radius: number): boolean {
        let filledCount = 0;
        let totalCount = 0;

        for (let x = centerX - radius; x <= centerX + radius; x++) {
            for (let y = centerY - radius; y <= centerY + radius; y++) {
                totalCount++;
                if (tiles.some((tile) => tile.x === x && tile.y === y)) {
                    filledCount++;
                }
            }
        }

        return filledCount / totalCount > 0.8; // 80% filled
    }

    private static isCorridor(tiles: ITileData[], centerX: number, centerY: number): boolean {
        const center = tiles.find((tile) => tile.x === centerX && tile.y === centerY);
        if (!center) return false;

        // Check horizontal corridor
        const hasLeft = tiles.some((tile) => tile.x === centerX - 1 && tile.y === centerY && tile.type === center.type);
        const hasRight = tiles.some((tile) => tile.x === centerX + 1 && tile.y === centerY && tile.type === center.type);
        const hasTop = tiles.some((tile) => tile.x === centerX && tile.y === centerY + 1 && tile.type === center.type);
        const hasBottom = tiles.some((tile) => tile.x === centerX && tile.y === centerY - 1 && tile.type === center.type);

        return (hasLeft && hasRight && !hasTop && !hasBottom) || (!hasLeft && !hasRight && hasTop && hasBottom);
    }

    private static isCorner(tiles: ITileData[], centerX: number, centerY: number): boolean {
        const center = tiles.find((tile) => tile.x === centerX && tile.y === centerY);
        if (!center) return false;

        const neighbors = [
            tiles.some((tile) => tile.x === centerX && tile.y === centerY + 1 && tile.type === center.type), // top
            tiles.some((tile) => tile.x === centerX + 1 && tile.y === centerY && tile.type === center.type), // right
            tiles.some((tile) => tile.x === centerX && tile.y === centerY - 1 && tile.type === center.type), // bottom
            tiles.some((tile) => tile.x === centerX - 1 && tile.y === centerY && tile.type === center.type), // left
        ];

        const connectedSides = neighbors.filter((n) => n).length;
        return connectedSides === 2 && !((neighbors[0] && neighbors[2]) || (neighbors[1] && neighbors[3]));
    }

    private static isIsolated(tiles: ITileData[], centerX: number, centerY: number): boolean {
        const center = tiles.find((tile) => tile.x === centerX && tile.y === centerY);
        if (!center) return false;

        // Check all 8 neighbors
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                if (tiles.some((tile) => tile.x === centerX + dx && tile.y === centerY + dy && tile.type === center.type)) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Generate tile variants for better visual variety
     */
    static getTileVariant(tileData: ITileData, variantCount: number = 3): number {
        // Use tile position to generate consistent but varied indices
        const hash = (tileData.x * 73 + tileData.y * 37) % variantCount;
        return Math.abs(hash);
    }

    /**
     * Calculate smooth transitions between different tile types
     */
    static calculateTransitionRule(currentType: AutotileType, neighborType: AutotileType, direction: number): number {
        // Simple transition rules - can be expanded based on game needs
        const transitionPriority: { [key in AutotileType]: number } = {
            [AutotileType.WATER]: 0,
            [AutotileType.GROUND]: 1,
            [AutotileType.WALL]: 2,
            [AutotileType.SOLID]: 3,
        };

        const currentPriority = transitionPriority[currentType];
        const neighborPriority = transitionPriority[neighborType];

        // If neighbor has higher priority, consider it as a transition
        if (neighborPriority > currentPriority) {
            return direction;
        }

        return 0;
    }

    /**
     * Optimize autotile rules for performance
     */
    static optimizeRules(tiles: ITileData[]): Map<string, number> {
        const optimizedRules = new Map<string, number>();

        for (const tile of tiles) {
            const key = `${tile.x},${tile.y}`;

            // Cache commonly used rules
            if (optimizedRules.has(key)) {
                continue;
            }

            optimizedRules.set(key, tile.rule);
        }

        return optimizedRules;
    }

    /**
     * Generate autotile configuration for custom tile sets
     */
    static generateAutotileConfig(tileCount: number, layout: "linear" | "grid" | "blob" = "linear"): Map<number, number> {
        const config = new Map<number, number>();

        switch (layout) {
            case "linear":
                // Simple linear mapping for small tile sets
                for (let i = 0; i < Math.min(tileCount, 16); i++) {
                    config.set(i, i);
                }
                break;

            case "grid":
                // Grid-based mapping for organized tile sheets
                let index = 0;
                for (let rule = 0; rule < 256 && index < tileCount; rule++) {
                    if (this.isValidRule(rule)) {
                        config.set(rule, index++);
                    }
                }
                break;

            case "blob":
                // Blob-style mapping for complex autotile sets
                this.generateBlobMapping(config, tileCount);
                break;
        }

        return config;
    }

    private static isValidRule(rule: number): boolean {
        // Check if the rule represents a valid tile configuration
        const hasCardinalDirection = (rule & 15) > 0; // Has at least one of top, right, bottom, left
        return hasCardinalDirection;
    }

    private static generateBlobMapping(config: Map<number, number>, tileCount: number): void {
        // Define standard blob autotile rules in order of importance
        const blobRules = [
            0, // Isolated
            15, // All sides
            1,
            2,
            4,
            8, // Single sides
            3,
            6,
            12,
            9, // Adjacent sides
            7,
            14,
            13,
            11, // Three sides
            5,
            10, // Opposite sides
        ];

        for (let i = 0; i < Math.min(blobRules.length, tileCount); i++) {
            config.set(blobRules[i], i);
        }
    }
}
