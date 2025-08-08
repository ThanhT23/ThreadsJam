import { _decorator, Component, Sprite, Material, Vec4, Texture2D, EffectAsset } from "cc";
const { ccclass, property } = _decorator;

@ccclass("NormalMapController")
export class NormalMapController extends Component {
    @property(EffectAsset)
    effectAsset: EffectAsset | null = null;

    @property(Sprite)
    targetSprite: Sprite | null = null;

    @property(Texture2D)
    mainTexture: Texture2D | null = null;

    @property(Texture2D)
    normalMap: Texture2D | null = null;

    @property(Vec4)
    lightDir: Vec4 = new Vec4(0.0, 0.0, 1.0, 0.0);

    @property
    strength: number = 1.0;

    private _material: Material | null = null;

    onLoad() {
        return;
        if (!this.targetSprite) {
            this.targetSprite = this.getComponent(Sprite);
        }

        if (this.targetSprite?.customMaterial) {
            this._material = this.targetSprite.customMaterial;
            this.updateMaterialProperties();
        }
    }

    private updateMaterialProperties() {
        if (!this._material) return;

        // Cập nhật texture
        this._material.setProperty("mainTexture", this.mainTexture);
        this._material.setProperty("normalMap", this.normalMap);

        // Cập nhật uniform block
        this._material.setProperty("lightDir", this.lightDir, 0);
        this._material.setProperty("strength", this.strength, 0);
    }

    updateLightDir(newLightDir: Vec4) {
        this.lightDir = newLightDir;
        if (this._material) {
            this._material.setProperty("u_lightDir", newLightDir, 0);
        }
    }

    updateStrength(newStrength: number) {
        this.strength = newStrength;
        if (this._material) {
            this._material.setProperty("u_strength", newStrength, 0);
        }
    }
}
