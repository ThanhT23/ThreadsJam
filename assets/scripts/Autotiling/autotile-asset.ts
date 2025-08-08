import { assert, JsonAsset, Rect, Size, SpriteFrame, Texture2D, Vec2 } from "cc";

/** Metadata for image files used for autotiling*/
export type AutotileDefinition = {
    /** Size of a single tile in pixel */
    tileSize: { x: number; y: number };
    /** Number of columns in tile grid */
    width: number;
    /** Number of rows in tile grid */
    height: number;
    /** The tile grid, indexed by bitMap[column][row] */
    bitMap: (0 | 1)[][];
    /** Array of tiles eligable for autotiling */
    sprites: { x: number; y: number }[];
};

export class AutotileAsset {
    private bitmaskToSpriteFrame: Map<number, SpriteFrame> = new Map();

    constructor(texture: Texture2D, def: Readonly<AutotileDefinition>) {
        assert(def.bitMap.length === def.width, "Unmatched bitmap and size in definition");
        assert(
            def.bitMap.every((col) => col.length === def.height),
            "Unmatched bitmap and size in definition"
        );
        for (const sprite of def.sprites) {
            const bitmask = AutotileAsset.calculateBitMask(sprite.x, sprite.y, def);
            assert(!this.bitmaskToSpriteFrame.has(bitmask), "2 tiles with equal bitmask were both declared in definition");
            const spriteFrame = AutotileAsset.createSpriteFrame(texture, sprite.x, sprite.y, def.tileSize.x, def.tileSize.y);
            this.bitmaskToSpriteFrame.set(bitmask, spriteFrame);
        }
    }

    isTiledBitmask(bitmask: number) {
        return this.bitmaskToSpriteFrame.has(bitmask);
    }

    getSpriteFrame(bitmask: number) {
        return this.bitmaskToSpriteFrame.get(bitmask);
    }

    static toDefinition(jsonAsset: JsonAsset) {
        const json = jsonAsset.json;
        return json as AutotileDefinition;
    }

    private static calculateBitMask(x: number, y: number, def: AutotileDefinition) {
        let base = 1;
        let bitmask = 0;
        for (let ny = y - 1; ny < y + 2; ++ny) {
            for (let nx = x - 1; nx < x + 2; ++nx) {
                const isOutOfBorder = nx < 0 || ny < 0 || nx >= def.width || ny >= def.height;
                if (!isOutOfBorder && def.bitMap[nx][ny] === 1) {
                    bitmask += base;
                }
                base *= 2;
            }
        }
        return bitmask;
    }
    private static createSpriteFrame(texture: Texture2D, col: number, row: number, tileSizeX: number, tileSizeY: number) {
        const res = new SpriteFrame();
        res.texture = texture;
        res.rect = new Rect(col * tileSizeX, row * tileSizeY, tileSizeX, tileSizeY);
        res.originalSize = new Size(tileSizeX, tileSizeY);
        return res;
    }
}
