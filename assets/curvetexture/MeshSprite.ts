/**
 * 根据给定的mesh数据/纹理/材质,渲染出结果
 */

import {
  _decorator,
  CCBoolean,
  Component,
  EffectAsset,
  Material,
  Mesh,
  MeshRenderer,
  Node,
  SpriteFrame,
  Texture2D,
  UIMeshRenderer,
  utils,
  v3,
  v4,
  Vec3,
} from 'cc';
import earcut from './EarCut';
const { ccclass, property, executeInEditMode, menu } = _decorator;

@ccclass('MeshSprite')
@executeInEditMode
@menu('2D/MeshSprite(Mesh精灵)')
export class MeshSprite extends Component {
  @property(EffectAsset)
  private _effectAsset: EffectAsset = null!;
  @property({
    type: EffectAsset,
    tooltip: '渲染effectAssets文件,拖入curvetexture-sprite即可',
    displayName: 'effect asset文件',
  })
  public get effectAsset(): EffectAsset {
    return this._effectAsset;
  }
  public set effectAsset(value: EffectAsset) {
    if (value !== this._effectAsset) {
      this._mat?.destroy();
      this._mat = null;
      this._effectAsset?.destroy();
      this._effectAsset = value;
      this._refreshAll();
    }
  }

  @property(SpriteFrame)
  private _spriteFrame: SpriteFrame = null!;
  @property({
    type: SpriteFrame,
    tooltip: '纹理文件,拖入spriteframe即可',
    displayName: '纹理文件',
  })
  get spriteFrame(): SpriteFrame {
    return this._spriteFrame;
  }
  set spriteFrame(value: SpriteFrame) {
    if (this._spriteFrame !== value) {
      this._spriteFrame = value;

      if (value) {
        if (
          (value.originalSize.width & (value.originalSize.width - 1)) !== 0 ||
          (value.originalSize.height & (value.originalSize.height - 1)) !== 0
        ) {
          console.warn(`纹理尺寸(${value.originalSize.width}x${value.originalSize.height})不是2的幂，请修改。`);
          return;
        }
      }

      if (this._spriteFrame) {
        this._curve_width = this._spriteFrame.originalSize.width;
        this._curve_height = this._spriteFrame.originalSize.height;
      }
      this._refreshAll();
    }
  }

  @property({})
  private _updownFix: boolean = false;
  @property({
    tooltip: `是否上下翻转纹理,默认false`,
    displayName: `是否上下翻转`,
  })
  get updownFix() {
    return this._updownFix;
  }
  set updownFix(value) {
    this._updownFix = value;
    this._refreshAll();
  }

  private _meshRender: MeshRenderer = null;
  private _uiMeshRender: UIMeshRenderer = null;
  private _mat: Material = null;
  private _vertexes: Vec3[] = [
    v3(-200, 200, 0), // 左上
    v3(-200, -200, 0), // 左下
    v3(200, -200, 0), // 右下
    v3(200, 200, 0), // 右上
  ];
  private _curve_width = 0;
  private _curve_height = 0;

  private _uvs: number[] = [];

  protected onEnable(): void {
    this._refreshAll();
  }

  public setVertexes(vertexes: Vec3[]) {
    this._vertexes = vertexes;
    this._refreshAll();
  }

  private _refreshAll() {
    if (!this._spriteFrame) {
      console.warn(`没有spriteFrame,请拖入纹理`);
      return;
    }
    if (!this._effectAsset) {
      console.warn(`没有effectAsset,请拖入effect文件 curvetexture-sprite`);
      return;
    }

    this._meshRender = this.node.getComponent(MeshRenderer);

    if (!this._meshRender) {
      this._meshRender = this.node.addComponent(MeshRenderer);
    }
    this._uiMeshRender = this.node.getComponent(UIMeshRenderer);
    if (!this._uiMeshRender) {
      this._uiMeshRender = this.node.addComponent(UIMeshRenderer);
    }
    this._mat = this._meshRender.getMaterialInstance(0) as Material;
    if (!this._mat) {
      this._mat = new Material();
      this._mat.initialize({
        effectAsset: this._effectAsset,
        defines: {
          USE_TEXTURE: true,
        },
      });
      this._meshRender.setMaterialInstance(this._mat, 0);
    }
    this._spriteFrame.texture.setWrapMode(
      Texture2D.WrapMode.REPEAT,
      Texture2D.WrapMode.REPEAT,
      Texture2D.WrapMode.REPEAT
    );

    this._curve_width = this._spriteFrame.originalSize.width;
    this._curve_height = this._spriteFrame.originalSize.height;
    this._mat.setProperty('mainTexture', this._spriteFrame.texture, 0);
    const uv = this._spriteFrame.uv;
    const uv_x = uv[0]; // ul
    const uv_y = uv[1]; // vb
    const uv_w = uv[6] - uv[0]; // ur - ul
    const uv_h = uv[5] - uv[1]; // vt - vb
    const altlasUV = v4(uv_x, uv_y, uv_w, uv_h);
    // console.log(this.node.name + ' altlasUV', altlasUV);
    this._mat.setProperty('altlasUV', altlasUV, 0);

    const positions: number[] = [];
    // const positions2d: number[] = [];
    for (let i = 0; i < this._vertexes.length; i++) {
      const v = this._vertexes[i];
      positions.push(v.x, v.y, v.z);
      //   positions2d.push(v.x, v.y);
    }
    // if (this._uvs.length <= 8) {
    this._uvs = this._calculateUVs();
    // }
    const start = performance.now();
    const indices: number[] = earcut(positions, null, 3);
    const end = performance.now();
    // console.log(`earcut triangulation 解析转换为渲染三角形索引耗时 took ${(end - start).toFixed(2)} ms`);
    // console.log(this.node.name + ' indices ', indices);

    let mesh = utils.MeshUtils.createMesh({
      positions: positions,
      uvs: this._uvs,
      indices: indices,
    });

    if (this._meshRender!.mesh) {
      this._meshRender!.mesh.destroy();
    }
    this._meshRender!.mesh = mesh;
  }

  private _calculateUVs() {
    let uvs: number[] = [];
    if (!this._spriteFrame || this._vertexes.length === 0) {
      return uvs;
    }

    for (let i = 0; i < this._vertexes.length; i++) {
      const d = this._vertexes[i];
      const u = d.x / this._curve_width;
      let v = 1.0 - d.y / this._curve_height;
      if (this._updownFix) {
        v = d.y / this._curve_height;
      }
      uvs.push(u, v);
    }

    return uvs;
  }
}
