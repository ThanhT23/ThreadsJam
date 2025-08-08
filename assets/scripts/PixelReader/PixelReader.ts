import {
    _decorator,
    Component,
    Sprite,
    RenderTexture,
    Camera,
    Color,
    Node,
    UITransform,
    EventTouch,
    director,
    gfx,
    Texture2D,
    Vec2,
    Vec4,
    SpriteFrame,
} from "cc";
import { PixelPainter } from "./PixelPainter";
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass("PixelReader")
@executeInEditMode
export class PixelReader extends Component {
    @property(SpriteFrame)
    targetFrame: SpriteFrame = null!;

    @property(PixelPainter) pixelPainter: PixelPainter = null!;

    private renderTexture: RenderTexture | null = null;
    private spriteWidth: number = 0;
    private spriteHeight: number = 0;
    private pixelData: Uint8Array | null = null;
    private isReady: boolean = false;
    private spriteBufferMap: Map<SpriteFrame, Uint8Array> = new Map();
    private texture: Texture2D = null!;

    async onLoad() {
        const thiz = this;
        if (!this.targetFrame) {
            console.error("Target frame is missing!");
            return;
        }
        if (this.texture) {
            this.texture.destroy();
            this.texture = null;
        }
        // Xóa cache sprite buffer
        this.spriteBufferMap.clear();

        await new Promise((resolve) => setTimeout(resolve, 500));

        this.pixelData = this.readPixelsFromSprite(this.targetFrame);
        console.log(this.pixelData);

        this.pixelPainter.initCanvas();
        // const max = 32;
        this.pixelPainter.applyMiniMapToTiles(this.pixelData, 32, 32);

        var list: { x: number; y: number; alpha?: number }[] = [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 2, y: 1 },
            { x: 2, y: 2 },
            { x: 3, y: 3 },
            { x: 4, y: 4 },
            { x: 5, y: 5 },
            { x: 6, y: 6 },
            { x: 7, y: 7 },
            { x: 8, y: 8 },
            { x: 9, y: 9 },
            { x: 10, y: 10 },
            { x: 11, y: 11 },
            { x: 12, y: 12 },
            { x: 13, y: 13 },
            { x: 14, y: 14 },
            { x: 15, y: 15 },
            { x: 16, y: 16 },
            { x: 17, y: 17 },
            { x: 18, y: 18 },
            { x: 19, y: 19 },
            { x: 20, y: 20 },
            { x: 21, y: 21 },
            { x: 22, y: 22 },
            { x: 23, y: 23 },
            { x: 24, y: 24 },
            { x: 25, y: 25 },
            { x: 26, y: 26 },
            { x: 27, y: 27 },
            { x: 28, y: 28 },
            { x: 29, y: 29 },
            { x: 30, y: 30 },
            { x: 31, y: 31 },
        ];
        // this.pixelPainter.applyListToTiles(this.pixelData, list);
    }

    private async initializePixelReader() {
        const spriteFrame = this.targetFrame!;
        const rect = spriteFrame.rect;
        this.spriteWidth = Math.floor(rect.width);
        this.spriteHeight = Math.floor(rect.height);

        // Tạo RenderTexture
        this.renderTexture = new RenderTexture();
        this.renderTexture.reset({
            width: this.spriteWidth,
            height: this.spriteHeight,
        });

        // Tạo camera ảo
        const cameraNode = new Node("PixelReaderCamera");
        cameraNode.parent = this.node;
        const camera = cameraNode.addComponent(Camera);
        camera.clearColor = Color.TRANSPARENT;
        camera.orthoHeight = this.spriteHeight / 2;
        camera.near = 0.1;
        camera.far = 1000;
        camera.targetTexture = this.renderTexture;

        // Đặt vị trí camera
        cameraNode.setPosition(0, 0, 500);

        // Tạo sprite node
        const spriteNode = new Node("SpriteRenderer");
        spriteNode.parent = cameraNode.parent;
        const spriteComp = spriteNode.addComponent(Sprite);
        spriteComp.spriteFrame = spriteFrame;

        // Căn chỉnh kích thước
        const uiTransform = spriteNode.addComponent(UITransform);
        uiTransform.contentSize.set(rect.width, rect.height);

        // Render sprite
        director.root.frameMove(0);

        // Đọc pixel data
        this.pixelData = this.readPixelsFromSprite(spriteFrame);

        console.log(`Pixel data read successfully: ${this.pixelData}`);

        // Dọn dẹp
        spriteNode.destroy();
        cameraNode.destroy();

        this.isReady = true;
        console.log("Pixel Reader initialized successfully!");
    }

    private readPixels(): Promise<Uint8Array> {
        return new Promise((resolve) => {
            if (!this.renderTexture) {
                resolve(new Uint8Array(this.spriteWidth * this.spriteHeight * 4));
                return;
            }

            const pixels = this.renderTexture.readPixels(0, 0, this.spriteWidth, this.spriteHeight);
            resolve(pixels as Uint8Array);
        });
    }
    public readPixelsFromSprite(spriteFrame: SpriteFrame) {
        let buffer: Uint8Array = null;
        if (this.spriteBufferMap.has(spriteFrame)) {
            buffer = this.spriteBufferMap.get(spriteFrame);
        }

        if (!buffer) {
            let texture = spriteFrame.texture;
            // this.texture = spriteFrame.texture as Texture2D;
            const rect = spriteFrame.rect;
            this.spriteWidth = Math.floor(rect.width) / 3;
            this.spriteHeight = Math.floor(rect.height) / 3;
            let tx = spriteFrame.rect.x;
            let ty = spriteFrame.rect.y;
            if (spriteFrame.packable && spriteFrame.original) {
                texture = spriteFrame.original._texture;
                tx = spriteFrame.original._x;
                ty = spriteFrame.original._y;
            }
            let width = spriteFrame.rect.width;
            let height = spriteFrame.rect.height;

            let gfxTexture = texture.getGFXTexture();
            let gfxDevice = texture["_getGFXDevice"]();
            let bufferViews = [];
            let region = new gfx.BufferTextureCopy();
            buffer = new Uint8Array(width * height * 4);
            (region.texOffset.x = tx), (region.texOffset.y = ty);
            region.texExtent.width = width;
            region.texExtent.height = height;
            bufferViews.push(buffer);
            gfxDevice?.copyTextureToBuffers(gfxTexture, bufferViews, [region]);
            this.spriteBufferMap.set(spriteFrame, buffer);
        }

        return buffer;
    }

    // public getPixelAtUIPosition(uiPosition: any): { r: number; g: number; b: number; a: number } | null {
    // if (!this.targetFrame || !this.pixelData) return null;

    // // Chuyển đổi tọa độ UI sang tọa độ local sprite
    // const uiTransform = this.targetFrame.node.getComponent(UITransform)!;
    // const localPos = uiTransform.convertToNodeSpaceAR(uiPosition);

    // // Tính toán tọa độ pixel
    // const pixelX = Math.floor(localPos.x + this.spriteWidth / 2);
    // const pixelY = Math.floor(localPos.y + this.spriteHeight / 2);

    // // Kiểm tra giới hạn
    // if (pixelX < 0 || pixelX >= this.spriteWidth || pixelY < 0 || pixelY >= this.spriteHeight) {
    //     console.warn(`Position out of bounds: (${pixelX}, ${pixelY})`);
    //     return null;
    // }

    // // Đảo ngược tọa độ Y (do RenderTexture gốc ở dưới cùng)
    // const renderTextureY = this.spriteHeight - pixelY - 1;
    // const pixelIndex = (renderTextureY * this.spriteWidth + pixelX) * 4;

    // return {
    //     r: this.pixelData[pixelIndex],
    //     g: this.pixelData[pixelIndex + 1],
    //     b: this.pixelData[pixelIndex + 2],
    //     a: this.pixelData[pixelIndex + 3],
    // };
    // }
    public getPixelColorAtIndex(index: number): { r: number; g: number; b: number; a: number; hex: string } | null {
        if (!this.pixelData) return null;
        if (index < 0 || index >= this.pixelData.length / 4) {
            console.warn(`Index out of bounds: ${index}`);
            return null;
        }
        const pixelIndex = index * 4;
        return {
            r: this.pixelData[pixelIndex],
            g: this.pixelData[pixelIndex + 1],
            b: this.pixelData[pixelIndex + 2],
            a: this.pixelData[pixelIndex + 3],
            hex: this.rgbToHex(this.pixelData[pixelIndex], this.pixelData[pixelIndex + 1], this.pixelData[pixelIndex + 2]),
        };
    }

    private rgbToHex(r: number, g: number, b: number): string {
        return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }
}
