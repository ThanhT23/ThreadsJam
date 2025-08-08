/**
 * 根据给定的mesh数据/纹理/材质,渲染出结果
 */

import {
  _decorator,
  CCBoolean,
  Component,
  dynamicAtlasManager,
  EffectAsset,
  IAssembler,
  IAssemblerManager,
  IRenderData,
  Material,
  Mesh,
  MeshRenderer,
  Node,
  RenderData,
  SpriteFrame,
  Texture2D,
  TransformBit,
  UIMeshRenderer,
  UIRenderer,
  utils,
  v3,
  v4,
  Vec3,
} from 'cc';
import earcut from './EarCut';
import { JSB } from 'cc/env';
const { ccclass, property, executeInEditMode, menu, disallowMultiple } = _decorator;

@ccclass('MeshSpriteAssembler')
@executeInEditMode
@menu('2D/MeshSpriteAssembler(Mesh精灵Assembler版本)')
@disallowMultiple
export class MeshSpriteAssembler extends UIRenderer {
  // @property(EffectAsset)
  // private _effectAsset: EffectAsset = null!;
  // @property({
  //   type: EffectAsset,
  //   tooltip: '渲染effectAssets文件,拖入curvetexture-sprite即可',
  //   displayName: 'effect asset文件',
  // })
  // public get effectAsset(): EffectAsset {
  //   return this._effectAsset;
  // }
  // public set effectAsset(value: EffectAsset) {
  //   if (value !== this._effectAsset) {
  //     this._mat?.destroy();
  //     this._mat = null;
  //     this._effectAsset?.destroy();
  //     this._effectAsset = value;
  //     this._refreshAll();
  //   }
  // }

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

  // private _meshRender: MeshRenderer = null;
  // private _uiMeshRender: UIMeshRenderer = null;
  // private _mat: Material = null;
  private _vertexes: Vec3[] = [
    v3(-200, 200, 0), // 左上
    v3(-200, -200, 0), // 左下
    v3(200, -200, 0), // 右下
    v3(200, 200, 0), // 右上
  ];
  private _curve_width = 0;
  private _curve_height = 0;

  private _positions: number[] = [];
  get positions(): number[] {
    return this._positions;
  }
  private _uvs: number[] = [];
  get uvs(): number[] {
    return this._uvs;
  }
  private _indices: number[] = [];
  get indices(): number[] {
    return this._indices;
  }

  onEnable(): void {
    super.onEnable();

    //当有trs任一变换时,需要刷新渲染
    this.node.off(Node.EventType.TRANSFORM_CHANGED);
    this.node.on(
      Node.EventType.TRANSFORM_CHANGED,
      (type: TransformBit) => {
        if (type & Node.TransformBit.TRS) {
          this._refreshAll();
        }
      },
      this
    );
    this._refreshAll();
  }

  //@ts-ignore
  protected _render(render: IBatcher): void {
    render.commitComp(this, this.renderData, this._spriteFrame, this._assembler!, null);
  }

  protected _canRender(): boolean {
    if (!super._canRender()) {
      return false;
    }

    if (!this._spriteFrame || !this._spriteFrame.texture) {
      return false;
    }
    // console.log(`${this.node.name} CurveTextureAssembler.ts _canRender() true`);
    return true;
  }

  protected _flushAssembler(): void {
    const assembler = MeshSpriteAssembler.Assembler.getAssembler(this);

    if (this._assembler !== assembler) {
      this.destroyRenderData();
      this._assembler = assembler;
    }

    if (!this.renderData) {
      if (this._assembler && this._assembler.createData) {
        this._renderData = this._assembler.createData(this) as RenderData;
        this.renderData!.material = this.material;
        this._updateColor();
      }
    }
  }
  public onDestroy() {
    //如果有自身需要销毁的,可以在这里处理
    //todo
    super.onDestroy();
  }

  public setVertexes(indata: Vec3[]) {
    this._vertexes = indata.map((v) => v3(v.x, v.y, v.z || 0));
    // console.log(`MeshSpriteAssembler.ts setVertexes() vertexes.length=${this._vertexes.length}   ${this._vertexes}`);
    this._refreshAll();
  }

  private _refreshAll() {
    if (!this._spriteFrame) {
      console.warn(`没有spriteFrame,请拖入纹理`);
      return;
    }

    this._spriteFrame.texture.setWrapMode(
      Texture2D.WrapMode.REPEAT,
      Texture2D.WrapMode.REPEAT
      // Texture2D.WrapMode.REPEAT
    );

    this._curve_width = this._spriteFrame.originalSize.width;
    this._curve_height = this._spriteFrame.originalSize.height;
    const positions: number[] = [];
    for (let i = 0; i < this._vertexes.length; i++) {
      const v = this._vertexes[i];
      positions.push(v.x, v.y, 0);
    }
    // if (this._uvs.length <= 8) {
    const uvs = this._calculateUVs();
    // }
    const start = performance.now();
    const indices: number[] = earcut(positions, null, 3);
    // const indices: number[] = [];
    // for (let i = 0; i < this._vertexes.length - 2; i++) {
    //   indices.push(0);
    //   indices.push(i + 1);
    //   indices.push(i + 2);
    // }
    const end = performance.now();
    // console.log(`earcut triangulation 解析转换为渲染三角形索引耗时 took ${(end - start).toFixed(2)} ms`);

    this._positions = positions;
    this._uvs = uvs;
    this._indices = indices;

    // console.log(
    //   `MeshSpriteAssembler.ts _refreshAll() positions.length=${positions.length}, uvs.length=${uvs.length}, indices.length=${indices.length}`
    // );
    this.markForUpdateRenderData();
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

  //被添加到动态合图中后对已有uv数据进行转换
  public udpateUVsAfterAddedToDynamicAtlas() {
    const uv = this._spriteFrame.uv;
    const uv_x = uv[0]; // ul
    const uv_y = uv[1]; // vb
    const uv_w = uv[6] - uv[0]; // ur - ul
    const uv_h = uv[5] - uv[1]; // vt - vb
    const altlasUV = v4(uv_x, uv_y, uv_w, uv_h);
    // vec2 uvOrigin = altlasUV.xy;
    // vec2 uvSize = altlasUV.zw;
    // vec2 mapUV = uvOrigin + uvTmp * uvSize;
    const uvs = this._uvs;
    for (let i = 0; i < uvs.length; i += 2) {
      const u = uvs[i]; // u coordinate
      const v = uvs[i + 1]; // v coordinate
      const mapU = uv_x + u * uv_w;
      const mapV = uv_y + v * uv_h;
      uvs[i] = mapU;
      uvs[i + 1] = mapV;
    }
  }
}

class MeshSpriteAssemblerImpl implements IAssembler {
  createData(comp: MeshSpriteAssembler): RenderData {
    const renderData = comp.requestRenderData();
    renderData.dataLength = 4;
    renderData.resize(4, 6);
    return renderData;
  }

  updateRenderData(comp: MeshSpriteAssembler): void {
    if (!comp) return;
    const renderData = comp.renderData;
    if (!renderData) return;
    if (!renderData.vertDirty) {
      return;
    }

    const vertCount = comp.positions.length / 3;
    // const indexCount = comp.indices.length;
    const indexCount = (vertCount - 2) * 3;
    if (0 === vertCount || 0 === indexCount) {
      renderData.vertDirty = false;
      console.warn(`顶点计算结果数量为0,请检查MeshSpriteAssembler组件的positions和indices计算结果是否有异常`);
      return;
    }

    //会重新设置底层的data的空间和数据初始化
    renderData.dataLength = vertCount;

    //更新中间数据
    const dataList: IRenderData[] = renderData.data;
    for (let i = 0; i < vertCount; ++i) {
      const item = dataList[i];
      const x = comp.positions[i * 3];
      const y = comp.positions[i * 3 + 1];
      item.x = x;
      item.y = y;
    }

    //设置标志位触发JSB的数据刷新
    if (renderData.vertexCount !== vertCount) {
      comp.renderEntity.colorDirty = true;
    }

    // if (vertCount != renderData.dataLength || indexCount != renderData.indexCount) {
    // if (vertCount != renderData.dataLength) {
    renderData.resize(vertCount, indexCount);
    // }

    if (comp.spriteFrame) {
      // DynamicAtlasManager.instance.packToDynamicAtlas(comp, comp.spriteFrame);
      const renderData = comp.renderData;
      //JSB部分的数据使用如下
      //顶点数据:renderData.data中的xyz,会单独同步到一份内存数据_render2dBuffer
      //UV数据使用的renderData.chunk.vb中uv部分
      //索引数据使用的renderData.chunk中单独的_ib
      if (JSB) {
        const tmp = new Uint16Array(indexCount).fill(0);
        const indices = comp.indices;
        const copyLength = Math.min(indices.length, indexCount);
        for (let i = 0; i < copyLength; ++i) {
          tmp[i] = indices[i];
        }
        const chunk = renderData.chunk;
        chunk.setIndexBuffer(tmp);
        this._updateJustUV(comp);
      }
      //会同步顶点数据到原生层数据 _render2dBuffer
      renderData.updateRenderData(comp, comp.spriteFrame);
    }
  }

  //@ts-ignore
  fillBuffers(comp: MeshSpriteAssembler, renderer: IBatcher): void {
    if (!comp) return;
    const renderData = comp.renderData;
    if (!renderData) return;
    if (renderData.vertDirty) {
      const vertCount = comp.positions.length / 3;
      const indexCount = comp.indices.length;
      if (0 === vertCount || 0 === indexCount) {
        console.warn(`顶点计算结果数量为0,请检查MeshSpriteAssembler组件的positions和indices计算结果是否有异常`);
        return;
      }
      this._updateVertexsAndUV(comp);
      renderData.vertDirty = false;
    }
    this._updateIndices(comp);
  }

  private _updateIndices(comp: MeshSpriteAssembler) {
    const renderData = comp.renderData;
    if (!renderData) return;
    const chunk = renderData.chunk;

    //OTHER
    const vid = chunk.vertexOffset;
    const meshBuffer = chunk.meshBuffer;
    const ib = meshBuffer.iData;
    let indexOffset = meshBuffer.indexOffset;
    for (let i = 0; i < comp.indices.length; ++i) {
      const index = comp.indices[i];
      ib[indexOffset++] = vid + index;
    }
    meshBuffer.indexOffset += comp.indices.length;
    // meshBuffer.setDirty();
  }

  private _updateVertexsAndUV(comp: MeshSpriteAssembler): void {
    const renderData = comp.renderData;
    if (!renderData) return;

    const vertCount = comp.positions.length / 3;
    const chunk = renderData.chunk;
    const vb = chunk.vb;
    const m = comp.node.worldMatrix;
    const stride = renderData.floatStride;
    let offset = 0;
    const color = comp.color;
    const colorR = color.r / 255;
    const colorG = color.g / 255;
    const colorB = color.b / 255;
    const colorA = color.a / 255;
    for (let i = 0; i < vertCount; ++i) {
      const x = comp.positions[i * 3];
      const y = comp.positions[i * 3 + 1];
      let rhw = m.m03 * x + m.m07 * y + m.m15;
      rhw = rhw ? 1 / rhw : 1;

      offset = i * stride;
      vb[offset + 0] = (m.m00 * x + m.m04 * y + m.m12) * rhw;
      vb[offset + 1] = (m.m01 * x + m.m05 * y + m.m13) * rhw;
      vb[offset + 2] = (m.m02 * x + m.m06 * y + m.m14) * rhw;
      vb[offset + 3] = comp.uvs[i * 2]; // u
      vb[offset + 4] = comp.uvs[i * 2 + 1]; // v
      vb[offset + 5] = colorR; // r
      vb[offset + 6] = colorG; // g
      vb[offset + 7] = colorB; // b
      vb[offset + 8] = colorA; // a
    }
  }

  updateColor(comp: MeshSpriteAssembler): void {
    const renderData = comp.renderData;
    if (!renderData) return;

    const vertCount = comp.positions.length / 3;
    const chunk = renderData.chunk;
    const vb = chunk.vb;
    const m = comp.node.worldMatrix;
    const stride = renderData.floatStride;
    let offset = 0;
    const color = comp.color;
    const colorR = color.r / 255;
    const colorG = color.g / 255;
    const colorB = color.b / 255;
    const colorA = color.a / 255;
    for (let i = 0; i < vertCount; ++i) {
      // const x = comp.positions[i * 3];
      // const y = comp.positions[i * 3 + 1];
      // let rhw = m.m03 * x + m.m07 * y + m.m15;
      // rhw = rhw ? 1 / rhw : 1;

      offset = i * stride;
      // vb[offset + 0] = (m.m00 * x + m.m04 * y + m.m12) * rhw;
      // vb[offset + 1] = (m.m01 * x + m.m05 * y + m.m13) * rhw;
      // vb[offset + 2] = (m.m02 * x + m.m06 * y + m.m14) * rhw;
      // vb[offset + 3] = comp.uvs[i * 2]; // u
      // vb[offset + 4] = comp.uvs[i * 2 + 1]; // v
      vb[offset + 5] = colorR; // r
      vb[offset + 6] = colorG; // g
      vb[offset + 7] = colorB; // b
      vb[offset + 8] = colorA; // a
    }
  }

  private _updateJustVertexs(comp: MeshSpriteAssembler): void {
    const renderData = comp.renderData;
    if (!renderData) return;

    const vertCount = comp.positions.length / 3;
    const chunk = renderData.chunk;
    const vb = chunk.vb;
    const m = comp.node.worldMatrix;
    const stride = renderData.floatStride;
    let offset = 0;
    // const color = comp.color;
    // const colorR = color.r / 255;
    // const colorG = color.g / 255;
    // const colorB = color.b / 255;
    // const colorA = color.a / 255;
    for (let i = 0; i < vertCount; ++i) {
      const x = comp.positions[i * 3];
      const y = comp.positions[i * 3 + 1];
      let rhw = m.m03 * x + m.m07 * y + m.m15;
      rhw = rhw ? 1 / rhw : 1;

      offset = i * stride;
      vb[offset + 0] = (m.m00 * x + m.m04 * y + m.m12) * rhw;
      vb[offset + 1] = (m.m01 * x + m.m05 * y + m.m13) * rhw;
      vb[offset + 2] = (m.m02 * x + m.m06 * y + m.m14) * rhw;
      // vb[offset + 3] = comp.uvs[i * 2]; // u
      // vb[offset + 4] = comp.uvs[i * 2 + 1]; // v
      // vb[offset + 5] = colorR; // r
      // vb[offset + 6] = colorG; // g
      // vb[offset + 7] = colorB; // b
      // vb[offset + 8] = colorA; // a
    }
  }

  //单独更新UV数据
  private _updateJustUV(comp: MeshSpriteAssembler): void {
    const renderData = comp.renderData;
    if (!renderData) return;

    const vertCount = comp.positions.length / 3;
    const chunk = renderData.chunk;
    const vb = chunk.vb;
    const m = comp.node.worldMatrix;
    const stride = renderData.floatStride;
    let offset = 0;
    for (let i = 0; i < vertCount; ++i) {
      // const x = comp.positions[i * 3];
      // const y = comp.positions[i * 3 + 1];
      // let rhw = m.m03 * x + m.m07 * y + m.m15;
      // rhw = rhw ? 1 / rhw : 1;

      offset = i * stride;
      // vb[offset + 0] = (m.m00 * x + m.m04 * y + m.m12) * rhw;
      // vb[offset + 1] = (m.m01 * x + m.m05 * y + m.m13) * rhw;
      // vb[offset + 2] = (m.m02 * x + m.m06 * y + m.m14) * rhw;
      vb[offset + 3] = comp.uvs[i * 2]; // u
      vb[offset + 4] = comp.uvs[i * 2 + 1]; // v
      // vb[offset + 5] = 1.0; // r
      // vb[offset + 6] = 1.0; // g
      // vb[offset + 7] = 1.0; // b
      // vb[offset + 8] = 1.0; // a
    }
  }
}

//如果有新的渲染模式,可以在这里切换不同的IAssmebler
const meshSpriteAssemblerImpl = new MeshSpriteAssemblerImpl();
const meshSpriteAssemblerImplMgr: IAssemblerManager = {
  getAssembler(comp: MeshSpriteAssembler): IAssembler {
    let assembler: IAssembler = meshSpriteAssemblerImpl;
    return assembler;
  },
};

MeshSpriteAssembler.Assembler = meshSpriteAssemblerImplMgr;
