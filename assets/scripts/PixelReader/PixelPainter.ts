import { _decorator, Component, Sprite, SpriteFrame, Texture2D, ImageAsset, Color, Material, EffectAsset, Vec4 } from "cc";
const { ccclass, property } = _decorator;

export interface TileFillData {
    x: number;
    y: number;
    color: Color;
    alpha?: number;
}

@ccclass("PixelPainter")
export class PixelPainter extends Component {
    @property(Sprite)
    sprite: Sprite = null;
    @property(SpriteFrame)
    spriteFrame: SpriteFrame = null;
    @property(EffectAsset)
    effect: EffectAsset = null!;
    @property(SpriteFrame)
    normalMap: SpriteFrame = null!;

    private ctx: CanvasRenderingContext2D = null!;
    private imgData: ImageData = null!;
    private width: number = 512;
    private height: number = 512;
    private tileSize: number = 16;
    private canvas: HTMLCanvasElement = null!;

    onLoad() {
        // Ví dụ: tô nhiều tile cùng lúc
        // this.initCanvas();
        // this.fillTiles([
        //     { x: 0, y: 0, color: new Color(0, 122, 255, 255), alpha: 0.5 }, // Xanh nhạt
        //     { x: 1, y: 0, color: new Color(255, 0, 0, 255), alpha: 0.4 }, // Đỏ nhạt
        //     { x: 0, y: 1, color: new Color(0, 255, 0, 255), alpha: 0.6 }, // Xanh lá đậm hơn
        // ]);
        // this.updateTexture();
    }

    public initCanvas() {
        const spriteFrame = this.spriteFrame.clone();
        let texture = spriteFrame.texture;
        if (spriteFrame.packable && spriteFrame.original) {
            texture = spriteFrame.original._texture; // đảm bảo lấy gốc
        }

        const tex2D = texture as Texture2D;
        const imageAsset = tex2D.image as ImageAsset;

        this.width = imageAsset.width;
        this.height = imageAsset.height;

        this.canvas = document.createElement("canvas");
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext("2d")!;

        this.ctx.drawImage(imageAsset.data as HTMLImageElement, 0, 0);
        this.imgData = this.ctx.getImageData(0, 0, this.width, this.height);
    }

    fillTile(tileX: number, tileY: number, color: Color, alpha: number = 0.5) {
        const startX = tileX * this.tileSize;
        const startY = tileY * this.tileSize;

        for (let y = 0; y < this.tileSize; y++) {
            for (let x = 0; x < this.tileSize; x++) {
                const px = startX + x;
                const py = startY + y;

                if (px < this.width && py < this.height) {
                    const index = (py * this.width + px) * 4;

                    const r = this.imgData.data[index];
                    const g = this.imgData.data[index + 1];
                    const b = this.imgData.data[index + 2];

                    this.imgData.data[index] = r * (1 - alpha) + color.r * alpha;
                    this.imgData.data[index + 1] = g * (1 - alpha) + color.g * alpha;
                    this.imgData.data[index + 2] = b * (1 - alpha) + color.b * alpha;
                }
            }
        }
    }

    fillTiles(tiles: TileFillData[]) {
        for (const tile of tiles) {
            const alpha = tile.alpha !== undefined ? tile.alpha : 0.5;
            this.fillTile(tile.x, tile.y, tile.color, alpha);
        }
    }

    updateTexture() {
        this.ctx.putImageData(this.imgData, 0, 0);

        const newImage = new Image();
        newImage.src = this.canvas.toDataURL();
        newImage.onload = () => {
            const newImageAsset = new ImageAsset(newImage);
            const newTexture = new Texture2D();
            newTexture.image = newImageAsset;

            const newSpriteFrame = new SpriteFrame();
            newSpriteFrame.texture = newTexture;

            this.sprite.spriteFrame = newSpriteFrame;

            // const mat = new Material();
            // mat.initialize({
            //     effectAsset: this.effect,
            //     technique: 0,
            // });

            // // let a = this.sprite.spriteFrame.texture as Texture2D;
            // mat.setProperty("mainTexture", newTexture);
            // mat.setProperty("normalMap", this.normalMap.texture);
            // mat.setProperty("lightDir", new Vec4(0.5, 0.5, 1.0, 0.0)); // hướng sáng
            // mat.setProperty("strength", 0.21); // độ mạnh của hiệu ứng

            // this.sprite.customMaterial = mat;
        };
        // this.parse();
    }

    applyMiniMapToTiles(buffer: Uint8Array, sourceWidth: number, sourceHeight: number) {
        const maxWidth = 32; // Kích thước tối đa của tile
        for (let y = 0; y < sourceHeight; y++) {
            for (let x = 0; x < sourceWidth; x++) {
                const index = (y * maxWidth + x) * 4;

                const r = buffer[index];
                const g = buffer[index + 1];
                const b = buffer[index + 2];
                const a = buffer[index + 3];

                const color = new Color(r, g, b, a);

                // Mỗi pixel của ảnh 16x16 tương ứng 1 tile trên ảnh 512x512
                this.fillTile(x, y, color, 0.8); // alpha = 0.5 để blend overlay
            }
        }
        this.updateTexture();
    }
    applyListToTiles(buffer: Uint8Array, tileList: { x: number; y: number; alpha?: number }[]) {
        for (const tile of tileList) {
            const index = (tile.y * 32 + tile.x) * 4;
            const r = buffer[index];
            const g = buffer[index + 1];
            const b = buffer[index + 2];
            const a = buffer[index + 3];
            const color = new Color(r, g, b, a);

            this.fillTile(tile.x, tile.y, color, tile.alpha || 0.8);
        }
        this.updateTexture();
    }

    paintPixels() {
        const spriteFrame = this.sprite.spriteFrame!;
        const texture = spriteFrame.texture as Texture2D;
        const imageAsset = texture.image as ImageAsset;

        const width = imageAsset.width;
        const height = imageAsset.height;

        // Tạo canvas để xử lý pixel
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;

        // Vẽ ảnh gốc lên canvas
        ctx.drawImage(imageAsset.data as HTMLImageElement, 0, 0);

        // Lấy dữ liệu pixel
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Ví dụ: tô màu xanh cho viền trên & trái 32px
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (x < 32 || y < 32) {
                    const index = (y * width + x) * 4;
                    data[index] = 0; // R
                    data[index + 1] = 122; // G
                    data[index + 2] = 255; // B
                    data[index + 3] = 255; // A
                }
            }
        }

        // Cập nhật lại canvas
        ctx.putImageData(imgData, 0, 0);

        // Tạo ImageAsset mới từ canvas
        const newImage = new Image();
        newImage.src = canvas.toDataURL();
        newImage.onload = () => {
            const newImageAsset = new ImageAsset(newImage);
            const newTexture = new Texture2D();
            newTexture.image = newImageAsset;

            const newSpriteFrame = new SpriteFrame();
            newSpriteFrame.texture = newTexture;

            this.sprite.spriteFrame = newSpriteFrame;
        };
    }
}
