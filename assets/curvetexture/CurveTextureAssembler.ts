/*
  CocosCreater 3.8.x 2d曲线纹理插件
  可用来制作2d横版的地形,如:山脉,道路等,类似登山赛车和滑雪大冒险的横版平滑的地图
  CocosCreater 3.8.x 2d comp texture plugin
  Can be used to make 2d side-scrolling terrain, such as: mountains, roads, etc., similar to the smooth maps in Hill Climb Racing and Ski Safari
  作者:soida
  Author: soida
  微信:soida3
  WeChat: soida3
  Cocos商店(https://store.cocos.com)也有出售,可直接搜索soida或者关键词'曲线纹理'
  Also available in the Cocos store(https://store.cocos.com), just search  the keyword 'soida' '曲线纹理' 'comp texture'
*/

// import { EDITOR, EDITOR_NOT_IN_PREVIEW } from 'cc/env';

import {
  _decorator,
  Asset,
  AssetManager,
  CCBoolean,
  CCFloat,
  CCInteger,
  Color,
  Component,
  DynamicAtlasManager,
  dynamicAtlasManager,
  EffectAsset,
  Enum,
  ERigidBody2DType,
  EventKeyboard,
  gfx,
  IAssembler,
  IAssemblerManager,
  Input,
  input,
  IRenderData,
  KeyCode,
  Mat4,
  Material,
  Mesh,
  MeshRenderer,
  misc,
  Node,
  PolygonCollider2D,
  RenderData,
  renderer,
  RenderTexture,
  resources,
  RigidBody2D,
  Sprite,
  SpriteFrame,
  sys,
  Texture2D,
  TransformBit,
  tween,
  Tween,
  UI,
  UIMeshRenderer,
  UIOpacity,
  UIRenderer,
  UITransform,
  utils,
  v2,
  v3,
  v4,
  Vec2,
  Vec3,
} from 'cc';
import { DEBUG, EDITOR, EDITOR_NOT_IN_PREVIEW, JSB } from 'cc/env';
import { MoveWithTouch } from './MoveWithTouch';
import { UsefulTools } from './UsefulTools';
import { MeshSpriteAssembler } from './MeshSpriteAssembler';
const { ccclass, property, executeInEditMode, requireComponent, disallowMultiple, menu, help } = _decorator;

function getGroupStyleName() {
  if (EDITOR) {
    //@ts-ignore
    const v = Editor.App.version;
    return UsefulTools.compareVersions(v, '3.8.0') >= 0 ? 'section' : 'tab';
  }
  return 'tab';
}
const GROUP_STYLE_NAME: string = getGroupStyleName();

//兼容低版本未定义
if (EDITOR_NOT_IN_PREVIEW === undefined) {
  console.warn('当前环境无 EDITOR_NOT_IN_PREVIEW 定义,开始兼容性定义');
  const EDITOR_NOT_IN_PREVIEW = EDITOR;
}

//判断Vec2类的原型是否有toVec3()方法,如果没有就添加一个
//@ts-ignore
if (!Vec2.prototype.toVec3) {
  console.warn('当前环境无 Vec2.toVec3() 定义,开始兼容性定义');
  //@ts-ignore
  Vec2.prototype.toVec3 = function (this: Vec2, z: number = 0): Vec3 {
    return new Vec3(this.x, this.y, z);
  };
}

//判断Vec3类的原型是否有toVec2()方法,如果没有就添加一个
//@ts-ignore
if (!Vec3.prototype.toVec2) {
  console.warn('当前环境无 Vec3.toVec2() 定义,开始兼容性定义');
  //@ts-ignore
  Vec3.prototype.toVec2 = function (this: Vec3): Vec2 {
    return new Vec2(this.x, this.y);
  };
}
/**
 *
 * @returns 是否编辑器中文环境,非运行环境 'Whether the editor is in Chinese environment, not running environment'
 */
export function inEditorZH(): boolean {
  if (EDITOR) {
    //@ts-ignore
    return Editor.I18n.getLanguage() === 'zh';
  }
  return false;
}

const IN_EDITOR_ZH: boolean = inEditorZH();

function isCloseToVec3(self: Vec3, other: Vec3, epsilon = 0.00001): boolean {
  const dx = self.x - other.x;
  const dy = self.y - other.y;
  const dz = self.z - other.z;
  const squaredDistance = dx * dx + dy * dy + dz * dz;
  return squaredDistance <= epsilon * epsilon;
}

function isCloseToVec2(self: Vec2, other: Vec2, epsilon = 0.00001): boolean {
  const dx = self.x - other.x;
  const dy = self.y - other.y;
  const squaredDistance = dx * dx + dy * dy;
  return squaredDistance <= epsilon * epsilon;
}

export enum TerrainRenderMode {
  VERTICAL_MODE = 0, //正常竖直模式,按照控制点竖直向下渲染
  TANGENT_MODE = 1, //切线模式,按照控制点的切线垂直方向向下渲染
  TANGENT_MODE_CENTER = 2, //切线模式,按照控制点在中心点,向上下各渲染一半的纹理高度
}

export enum TerrainRenderUVMode {
  UV_REPEAT_GRID = 0, //uv计算按照默认网格重复
  UV_REPEAT_LENGTH = 1, //uv计算按照长度重复
  UV_U_FROM_0_TO_1 = 2, //uv计算 u 从0到1
}

class CurveTextureAssemblerImpl implements IAssembler {
  createData(comp: CurveTextureAssembler): RenderData {
    const renderData = comp.requestRenderData();
    renderData.dataLength = 4;
    renderData.resize(4, 6);
    return renderData;
  }

  updateRenderData(comp: CurveTextureAssembler): void {
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

    if (comp.spFrame) {
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
      renderData.updateRenderData(comp, comp.spFrame);
    }
  }

  //@ts-ignore
  fillBuffers(comp: CurveTextureAssembler, renderer: IBatcher): void {
    if (!comp) return;
    const renderData = comp.renderData;
    if (!renderData) return;
    if (renderData.vertDirty) {
      const vertCount = comp.positions.length / 3;
      const indexCount = comp.indices.length;
      if (0 === vertCount || 0 === indexCount) {
        console.warn(`顶点计算结果数量为0,请检查 CurveTextureAssembler 组件的positions和indices计算结果是否有异常`);
        return;
      }
      this._updateVertexsAndUV(comp);
      renderData.vertDirty = false;
    }
    this._updateIndices(comp);
  }

  private _updateIndices(comp: CurveTextureAssembler) {
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

  private _updateVertexsAndUV(comp: CurveTextureAssembler): void {
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

  updateColor(comp: CurveTextureAssembler): void {
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

  private _updateJustVertexs(comp: CurveTextureAssembler): void {
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
  private _updateJustUV(comp: CurveTextureAssembler): void {
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

@ccclass('CurveTextureAssembler')
// @requireComponent(MeshRenderer)
@disallowMultiple
@executeInEditMode
// @help('https://github.com/soidaken/CurveTexture2d')
@menu('2D/CurveTextureAssembler(曲线纹理2d)')
export class CurveTextureAssembler extends UIRenderer {
  private _curve_width: number = 512;
  private _curve_height: number = 512;
  private _curve_height_result: number = 512;
  private _curve_collider_thickness: number = 0;
  // private _isZH: boolean = sys.language == 'zh';

  private _headNode: Node | null = null;
  private _tailNode: Node | null = null;

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

  @property({})
  private _syncOnOff: boolean = false;
  @property({
    tooltip: IN_EDITOR_ZH
      ? '自动同步另一个节点的地形数据,开启后此节点无法编辑地形'
      : ' (Automatically sync terrain data from another node, this node cannot edit terrain when enabled)',
    displayName: IN_EDITOR_ZH ? '开启跟随模式' : ' Enable Follow Mode',
  })
  get syncOnOff() {
    return this._syncOnOff;
  }
  set syncOnOff(value) {
    if (!value) {
      this.syncTarget = null;
    }
    this._syncOnOff = value;
    this._refreshAll();
  }

  @property({ type: Node })
  private _syncTarget: Node | null = null;
  @property({
    type: Node,
    tooltip: IN_EDITOR_ZH ? '跟随的目标节点' : ' (Target node to follow)',
    displayName: IN_EDITOR_ZH ? '跟随目标' : ' (Follow Target)',
    // visible() {
    //   return this._syncOnOff;
    // },
  })
  get syncTarget() {
    return this._syncTarget;
  }
  set syncTarget(value) {
    if (this._syncOnOff) {
      if (value) {
        let c = value.getComponent(CurveTextureAssembler);
        if (!c) {
          console.warn(
            IN_EDITOR_ZH
              ? '跟随目标节点没有CurveTexture组件,请添加'
              : ' (The target node to follow does not have a CurveTextureAssembler component, please add it)'
          );
          return;
        }
        if (value === this.node) {
          console.warn(IN_EDITOR_ZH ? '跟随目标节点不能是自己' : ' (The target node to follow cannot be itself)');
          return;
        }

        //防止循环跟随 'Prevent circular following'
        if (c.syncTarget) {
          if (c.syncTarget === this.node) {
            console.warn(
              IN_EDITOR_ZH ? '出现循环跟随啦,非法操作!' : ' (Circular following detected, illegal operation!)'
            );
            return;
          }
        }
      }
      this._syncTarget = value;

      this._refreshAll();
    } else {
      console.warn(IN_EDITOR_ZH ? '需要先开启跟随模式' : ' (Follow mode needs to be enabled first)');
    }
  }

  @property({ type: Enum(TerrainRenderMode) })
  private _renderMode: TerrainRenderMode = TerrainRenderMode.VERTICAL_MODE;
  @property({
    type: Enum(TerrainRenderMode),
    tooltip: IN_EDITOR_ZH
      ? '渲染顶点模式,VERTICAL_MODE为按照控制点竖直向下渲染,适合厚纹理;TANGENT_MODE/TANGENT_MODE_CENTER为按照控制点的切线垂直方向向下渲染,适合细纹理'
      : ' (Terrain rendering mode, VERTICAL_MODE renders vertically downward according to control points, suitable for thick textures; TANGENT_MODE/TANGENT_MODE_CENTER renders vertically downward according to the tangent direction of control points, suitable for thin textures)',
    displayName: IN_EDITOR_ZH ? '渲染顶点模式' : ' Terrain Rendering Mod',
    group: IN_EDITOR_ZH ? '渲染属性' : '(Terrain Rendering)',
  })
  get renderMode() {
    return this._renderMode;
  }
  set renderMode(value) {
    this._renderMode = value;
    // if (value == TerrainRenderMode.TANGENT_MODE || value == TerrainRenderMode.TANGENT_MODE_CENTER) {
    //   this._thickness = 0;
    // }
    this._refreshAll();
  }

  @property({ type: Enum(TerrainRenderUVMode) })
  private _renderUVMode: TerrainRenderUVMode = TerrainRenderUVMode.UV_REPEAT_GRID;
  @property({
    type: Enum(TerrainRenderUVMode),
    tooltip: IN_EDITOR_ZH
      ? '渲染UV模式,UV_REPEAT_GRID为按照默认网格重复;UV_REPEAT_LENGTH为按照长度重复'
      : ' (Terrain UV rendering mode, UV_REPEAT_GRID repeats according to the default grid; UV_REPEAT_LENGTH repeats according to length)',
    displayName: IN_EDITOR_ZH ? '渲染UV模式' : ' Terrain Rendering UV Mod',
    group: IN_EDITOR_ZH ? '渲染属性' : '(Terrain Rendering)',
  })
  get renderUVMode() {
    return this._renderUVMode;
  }
  set renderUVMode(value) {
    this._renderUVMode = value;
    // if (value == TerrainRenderMode.TANGENT_MODE || value == TerrainRenderMode.TANGENT_MODE_CENTER) {
    //   this._thickness = 0;
    // }
    this._refreshAll();
  }

  // @property({ type: EffectAsset })
  // private _spEffectAsset: EffectAsset | null = null;
  // @property({
  //   type: EffectAsset,
  //   tooltip: IN_EDITOR_ZH ? '渲染effect文件' : 'effect asset',
  //   displayName: IN_EDITOR_ZH ? '渲染effect文件' : 'effect asset',
  //   group: IN_EDITOR_ZH ? '渲染属性' : '(Terrain Rendering)',
  // })
  // get spEffectAsset() {
  //   return this._spEffectAsset;
  // }
  // set spEffectAsset(value) {
  //   this._spEffectAsset = value;

  //   this._refreshAll();
  // }

  private _gizmoInitColor: Color = new Color(255, 255, 255, 255);

  @property({ type: SpriteFrame })
  private _spFrame: SpriteFrame | null = null;
  @property({
    type: SpriteFrame,
    tooltip: IN_EDITOR_ZH ? '渲染纹理' : ' Terrain texture',
    displayName: IN_EDITOR_ZH ? '渲染纹理' : ' Terrain Texture',
    group: IN_EDITOR_ZH ? '渲染属性' : '(Terrain Rendering)',
  })
  get spFrame() {
    return this._spFrame;
  }
  set spFrame(value) {
    this._spFrame = value;
    //取纹理一片区域的颜色均值作为gizmo的颜色
    const uint8arr = RenderTexture.prototype.readPixels.call(
      value.texture,
      0,
      this._spFrame.originalSize.height / 2 - 2,
      4,
      4
    );
    let r = 0,
      g = 0,
      b = 0;
    for (let i = 0; i < uint8arr.length; i += 4) {
      r += uint8arr[i];
      g += uint8arr[i + 1];
      b += uint8arr[i + 2];
      //忽略alpha通道
    }
    r /= 16;
    g /= 16;
    b /= 16;
    // 将rgb值调整为同色系并提升亮度两个等级
    let [h, s, l] = UsefulTools.rgbToHsl(r, g, b);
    // 提升亮度两个等级（每级约0.08，提升0.16，最大不超过0.95）
    l = Math.min(l + 0.16, 0.95);
    [r, g, b] = UsefulTools.hslToRgb(h, s, l);

    this._gizmoInitColor.set(r, g, b, this.gizmoColor.a);
    // console.log('this._gizmoInitColor ', this._gizmoInitColor);
    this.gizmoColor = this._gizmoInitColor;
    this._refreshAll();
  }

  // @property({})
  private _headTailFixedOnOff: boolean = false;
  // @property({
  //   tooltip: IN_EDITOR_ZH ? '首尾是否有固定纹理' : 'head/tail fixed texture',
  //   displayName: IN_EDITOR_ZH ? '首尾是否有固定纹理' : 'head/tail fixed texture',
  //   group: IN_EDITOR_ZH ? '渲染属性' : '(Terrain Rendering)',
  //   visible(this: CurveTextureAssembler) {
  //     return (
  //       this._renderMode == TerrainRenderMode.TANGENT_MODE || this._renderMode == TerrainRenderMode.TANGENT_MODE_CENTER
  //     );
  //   },
  // })
  // get headTailFixedOnOff() {
  //   return this._headTailFixedOnOff;
  // }
  // set headTailFixedOnOff(value) {
  //   this._headTailFixedOnOff = value;
  //   this._refreshAll();
  // }

  @property({ type: SpriteFrame })
  private _headTailFrame: SpriteFrame | null = null;
  @property({
    type: SpriteFrame,
    tooltip: IN_EDITOR_ZH ? '首尾纹理' : ' Terrain texture',
    displayName: IN_EDITOR_ZH ? '首尾纹理' : ' Terrain Texture',
    group: IN_EDITOR_ZH ? '渲染属性' : '(Terrain Rendering)',
    visible(this: CurveTextureAssembler) {
      return this._headTailFixedOnOff == true;
    },
  })
  get headTailFrame() {
    return this._headTailFrame;
  }
  set headTailFrame(value) {
    this._headTailFrame = value;
    this._refreshAll();
  }

  // @property({})
  // private _alphaThreshold: number = 0.4;
  // @property({
  //   tooltip: IN_EDITOR_ZH
  //     ? '如果纹理有透明渲染异常,可以调整这里'
  //     : ' (If there is a transparent rendering issue with the texture, you can adjust here)',
  //   displayName: IN_EDITOR_ZH ? '如果纹理有透明' : ' If the texture has transparency',
  //   group: IN_EDITOR_ZH ? '渲染属性' : '(Terrain Rendering)',
  //   slide: true,
  //   range: [0, 1, 0.01],
  // })
  // get alphaThreshold() {
  //   return this._alphaThreshold;
  // }
  // set alphaThreshold(value) {
  //   this._alphaThreshold = value;
  //   this._refreshAll();
  // }

  @property({})
  private _updownFix: boolean = false;
  @property({
    tooltip: IN_EDITOR_ZH ? '如果上下反了,就来点点我!' : ' (If it is upside down, click me!)',
    displayName: IN_EDITOR_ZH ? '上下反了?' : ' (Upside Down?)',
    group: IN_EDITOR_ZH ? '渲染属性' : ' (Terrain Rendering)',
  })
  get updownFix() {
    return this._updownFix;
  }
  set updownFix(value) {
    this._updownFix = value;
    this._refreshAll();
  }

  @property({})
  private _thickness: number = 0;
  @property({
    tooltip: IN_EDITOR_ZH
      ? '地形的厚度,填0是设置为纹理高度值'
      : ' (Thickness of the terrain, 0 sets it to the texture height value)',
    displayName: IN_EDITOR_ZH ? '渲染厚度' : ' (Terrain Thickness)',
    group: IN_EDITOR_ZH ? '渲染属性' : ' (Terrain Rendering)',
    range: [0, 1024, 1],
    // visible(this: CurveTextureAssembler) {
    //   return this._renderMode == TerrainRenderMode.VERTICAL_MODE;
    // },
  })
  get thickness() {
    return this._thickness;
  }
  set thickness(value) {
    this._thickness = value;
    this._refreshAll();
  }

  @property({})
  private _offset: Vec3 = v3(0, 0, 0);
  @property({
    type: Vec3,
    tooltip: IN_EDITOR_ZH
      ? '渲染起始的偏移值,z暂时无效'
      : ' (Offset value for rendering start, z is temporarily invalid)',
    group: IN_EDITOR_ZH ? '渲染属性' : ' (Terrain Rendering)',
    displayName: IN_EDITOR_ZH ? '渲染偏移' : ' (Rendering Offset)',
  })
  get offset() {
    return this._offset;
  }
  set offset(value) {
    this._offset = value;
    this._offset.z = 0;
    this._refreshAll();
  }

  // @property({})
  private _controlPoints: Vec3[] = [v3(-500, -130, 0), v3(-160, 30, 0), v3(160, -130, 0), v3(500, 30, 0)];
  get controlPoints() {
    return this._controlPoints;
  }
  set controlPoints(value) {
    this._controlPoints = null;
    this._controlPoints = value.slice();
    this._refreshAll();
  }

  @property({})
  private _smoothness: number = 16;
  @property({
    type: CCInteger,
    tooltip: IN_EDITOR_ZH
      ? '每两控制点之间细分的数量,默认16,如果是0,则不细分'
      : ' (Number of subdivisions between every two control points, default is 16)',
    displayName: IN_EDITOR_ZH ? '细分点数量' : ' (Number of Subdivided Points)',
    group: IN_EDITOR_ZH ? '渲染属性' : ' (Terrain Rendering)',
    slide: true,
    range: [0, 32, 2],
  })
  get smoothness() {
    return this._smoothness;
  }
  set smoothness(value) {
    this._smoothness = value % 2 == 1 ? value + 1 : value;
    this._refreshAll();
  }

  @property({})
  private _headTailCloseOnoff: boolean = false;
  @property({
    tooltip: IN_EDITOR_ZH
      ? '是否首尾闭合,渲染为一个闭合的区域'
      : ' (Whether the head and tail are closed, rendered as a closed area)',
    displayName: IN_EDITOR_ZH ? '是否首尾闭合' : ' (Head and Tail Closure)',
    group: IN_EDITOR_ZH ? '首尾闭合属性' : ' (Head and Tail Closure Parameters)',
  })
  get headTailCloseOnoff() {
    return this._headTailCloseOnoff;
  }
  set headTailCloseOnoff(value) {
    if (!value) {
      this._headTailCloseOnoff = false;
      this._refreshAll();
      return;
    }
    //检测闭合后的顶点组成的多边形是否符合规则,1:不能自交 2:不能有连续共线点  3:不能有重复点
    //先检测控制点,符合规则后看有无必要再检测细分后的点
    const result2 = UsefulTools.isPolygonSelfIntersect(this._controlPoints);
    if (result2.result) {
      // console.log('length  ', this._editNodes.length);
      if (this._editNodes) {
        const n1 = this._editNodes[result2.index];
        const n2 = this._editNodes[result2.index + 1];
        n1.setScale(1.2, 1.2, 1);
        setTimeout(() => {
          n1.setScale(1, 1, 1);
        }, 250);
        n2.setScale(1.2, 1.2, 1);
        setTimeout(() => {
          n2.setScale(1, 1, 1);
        }, 250);
      }
      console.warn(
        IN_EDITOR_ZH
          ? `${this.node.name} 控制点有自相交,请检查! `
          : ' (Control points have self-intersection, please check!)'
      );
      return;
    }
    const result1 = UsefulTools.isCollinear(this._controlPoints);
    if (result1.result) {
      console.warn(
        IN_EDITOR_ZH
          ? `${this.node.name} 控制点有连续共线点,请检查! 点索引:${result1.index}/${result1.index + 1}/${
              result1.index + 2
            }`
          : ' (Control points have continuous collinear points, please check!)'
      );
      return;
    }
    if (UsefulTools.hasDuplicatePoints(this._controlPoints)) {
      console.warn(
        IN_EDITOR_ZH
          ? `${this.node.name} 控制点有重复点,请检查!`
          : ' (Control points have duplicate points, please check!)'
      );
      return;
    }

    this._headTailCloseOnoff = value;

    this._refreshAll();
  }

  @property({ type: MeshSpriteAssembler })
  private _innerMeshSprite: MeshSpriteAssembler | null = null;
  @property({
    tooltip: IN_EDITOR_ZH
      ? '闭合后内部渲染组件,如果不需要可以不设置'
      : ' (Inner rendering component after closure, if not needed, it can be left unset)',

    displayName: IN_EDITOR_ZH ? '闭合后内部渲染组件' : ' (Head and Tail Closure)',
    group: IN_EDITOR_ZH ? '首尾闭合属性' : ' (Head and Tail Closure Parameters)',
    type: MeshSpriteAssembler,
    visible(this: CurveTextureAssembler) {
      return this._headTailCloseOnoff;
    },
  })
  get innerMeshSprite(): MeshSpriteAssembler {
    return this._innerMeshSprite;
  }
  set innerMeshSprite(value: MeshSpriteAssembler) {
    this._innerMeshSprite = value;
    this._refreshAll();
  }

  @property({})
  private _physcisOnOff: boolean = false;
  @property({
    tooltip: IN_EDITOR_ZH
      ? '在一个特定子节点上添加[PhysicsPolygonCollider]组件,你也可以通过[getCurveTexturePoints] 获取数据后自己实现.'
      : 'Add a [PhysicsPolygonCollider] component to a specific child node, or you can implement it yourself after fetching data from [getCurveTexturePoints].)',
    displayName: IN_EDITOR_ZH ? '同步生成物理属性' : ' (Synchronize Generation of Physical Properties)',
    group: IN_EDITOR_ZH ? '物理属性' : ' (Physical Properties)',
  })
  get physcisOnOff() {
    return this._physcisOnOff;
  }
  set physcisOnOff(value) {
    this._physcisOnOff = value;

    this._refreshAll();
  }

  @property({})
  private _physicsThickness: number = 0;
  @property({
    type: CCFloat,
    tooltip: IN_EDITOR_ZH
      ? '物理碰撞器的厚度,填0是设置为纹理高度值'
      : ' (Thickness of the physical collider, 0 sets it to the texture height value)',
    displayName: IN_EDITOR_ZH ? '物理碰撞器厚度' : ' (Physical Collider Thickness)',
    group: IN_EDITOR_ZH ? '物理属性' : ' (Physical Properties)',
    visible(this: CurveTextureAssembler) {
      return this._physcisOnOff;
    },
  })
  get physicsThickness() {
    return this._physicsThickness;
  }
  set physicsThickness(value) {
    this._physicsThickness = value;
    this._refreshAll();
  }

  private _physicsCollider: PolygonCollider2D | null = null;

  //获取对应的物理碰撞器 'Get the corresponding physical collider'
  public get physicsCollider() {
    return this._physicsCollider;
  }

  @property({})
  private _offsetCollider: Vec3 = v3(0, 0, 0);
  @property({
    type: Vec3,
    tooltip: IN_EDITOR_ZH
      ? '物理碰撞器的偏移值,默认(0,0,0)'
      : ' (Offset value for the physical collider, default is (0,0,0))',
    displayName: IN_EDITOR_ZH ? '物理碰撞器偏移' : ' (Physical Collider Offset)',
    group: IN_EDITOR_ZH ? '物理属性' : ' (Physical Properties)',
    visible(this: CurveTextureAssembler) {
      return this._physcisOnOff;
    },
  })
  get offsetCollider() {
    return this._offsetCollider;
  }
  set offsetCollider(value) {
    this._offsetCollider = value;
    this._offsetCollider.z = 0;
    this._refreshAll();
    // if (this._physicsCollider) {
    //   this._physicsCollider.offset = this._offsetCollider.clone();
    // }
  }

  /**
   *
   * @returns 获取细分后的所有数据点,相对于当前节点坐标系 'Get all subdivided data points, relative to the current node coordinate system'
   */
  public getCurveTexturePoints(): Vec3[] {
    return this._vertexesSegment;
  }

  //
  // private _chainCollider: PhysicsChainCollider = null;

  //将编辑点 _controlPoints 细分后的平滑渲染点 'Smooth rendering points after subdividing the editing points _controlPoints'
  private _vertexesSegment: Vec3[] = [];
  /**
   * 获取细分后的所有数据点,相对于当前节点坐标系 'Get all subdivided data points, relative to the current node coordinate system'
   */
  get vertexesSegment() {
    return this._vertexesSegment;
  }

  //最终的渲染顶点数据 'Final rendering vertex data'
  private _vertexes: Vec3[] = [];
  // get vertexes() {
  //   return this._vertexes;
  // }
  // set vertexes(value) {
  //   this._controlPoints = value.slice();
  //   this._refreshAll();
  // }

  // private renderer: MeshRenderer | null = null;

  // public __preload(): void {
  //   // const mat = this._updateBuiltinMaterial();
  //   // this.setSharedMaterial(mat, 0);
  //   super.__preload();
  // }

  onLoad() {
    super.onLoad();
    let tmp: Vec3[] = [];
    let snodes: Node[] = [];
    for (let i = 0; i < this.node.children.length; i++) {
      const item = this.node.children[i];
      if (item.name.startsWith('gizmo_')) {
        snodes.push(item);
      }
    }
    if (this._sortInXDirection) {
      snodes.sort((a, b) => a.x - b.x);
      snodes.forEach((item, index) => {
        item.setSiblingIndex(index + 10);
      });
    }
    for (let i = 0; i < snodes.length; i++) {
      const item = snodes[i];
      tmp.push(item.position);
    }
    this._controlPoints = tmp.length > 0 ? tmp : this._controlPoints;
  }

  /**
   * 打印调试信息 'Print debug information'
   * _curve_width: 纹理宽度 'Texture width'
   * _curve_height: 纹理高度 'Texture height'
   * _controlPoints: 编辑点 'Editing points'
   * _vertexesSegment: 细分点 'Subdivided points'
   * _vertexes: 渲染点 'Rendering points'
   */
  debugPrint() {
    console.log(this.node.name + ' CurveTextureAssembler.ts debugPrint _curve_width : ', this._curve_width);
    console.log(this.node.name + ' CurveTextureAssembler.ts debugPrint _curve_height : ', this._curve_height);
    console.log(this.node.name + ' CurveTextureAssembler.ts debugPrint _controlPoints : ', this._controlPoints);
    console.log(this.node.name + ' CurveTextureAssembler.ts debugPrint _vertexesSegment : ', this._vertexesSegment);
    console.log(this.node.name + ' CurveTextureAssembler.ts debugPrint _vertexes : ', this._vertexes);
  }

  onEnable() {
    super.onEnable();

    this.node.off(Node.EventType.TRANSFORM_CHANGED);
    this.node.on(
      Node.EventType.TRANSFORM_CHANGED,
      (type: TransformBit) => {
        if (type & Node.TransformBit.TRS) {
          // console.log('CurveTextureAssembler.ts TRS changed, 刷新一次' + ' (refresh once)');
          this._refreshAll('559');
        }
      },
      this
    );
    // this._registerKeyForGizmo();
    this._refreshAll('565');
  }

  //@ts-ignore
  protected _render(render: IBatcher): void {
    render.commitComp(this, this.renderData, this._spFrame, this._assembler!, null);
  }

  protected _canRender(): boolean {
    if (!super._canRender()) {
      return false;
    }

    if (!this._spFrame || !this._spFrame.texture) {
      return false;
    }
    // console.log(`${this.node.name} CurveTextureAssembler.ts _canRender() true`);
    return true;
  }

  protected _flushAssembler(): void {
    const assembler = CurveTextureAssembler.Assembler.getAssembler(this);

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
    //
    super.onDestroy();
  }

  private _refreshAll(from: string = '') {
    // console.log(`from ${this.node.name} ${from}`);
    // let renderer = this.node.getComponent(MeshRenderer);
    // if (!renderer) {
    //   console.warn('MeshRenderer component not found!');
    //   return;
    // }
    // this.renderer = renderer;

    // //强制转换2d渲染模式,使用2d的层级管理
    // let uiMeshR = this.node.getComponent(UIMeshRenderer);
    // if (!uiMeshR) {
    //   this.node.addComponent(UIMeshRenderer);
    // }

    // if (!this.renderer) {
    //   console.warn(
    //     IN_EDITOR_ZH
    //       ? '没有MeshRenderer组件,请添加MeshRenderer组件!'
    //       : ' (No MeshRenderer component, please add MeshRenderer component!)'
    //   );
    //   return;
    // }

    let csame = this.node.getComponents(CurveTextureAssembler);
    if (csame.length > 1) {
      console.error(
        this.node.name + IN_EDITOR_ZH
          ? ' 请去除无用的[ CurveTextureAssembler ]组件,一个节点只需绑定一个,多个存在只会有最后一个生效!'
          : ' (Please remove unnecessary [CurveTextureAssembler] components, only one needs to be bound to a node, if multiple exist, only the last one will take effect!)'
      );
    }

    if (!this._spFrame) {
      console.warn(
        IN_EDITOR_ZH
          ? '还未指定 [ 渲染纹理 ],拖入插件默认的 [ terrain-ground ] 贴图即可!'
          : ' (The [Terrain Texture] has not been specified yet, drag in the default [terrain-ground] texture of the plugin!)'
      );
      return;
    }

    // if (!this._spEffectAsset) {
    //   console.warn(
    //     IN_EDITOR_ZH
    //       ? '还未指定 [ 渲染effect文件 ],拖入插件默认的 [ curvetexure-sprite.effect ] effect文件即可!'
    //       : ' (The [Effect Asset] has not been specified yet, drag in the default [curvetexure-sprite.effect] texture of the plugin!)'
    //   );
    //   return;
    // }

    this._curve_height = this._spFrame.originalSize.height; //纹理高度 'Texture height'
    this._curve_width = this._spFrame.originalSize.width;

    //检查纹理的宽和高是否是2的指数 'Check if the width and height of the texture are powers of 2'
    if (this._curve_width & (this._curve_width - 1)) {
      console.warn(
        IN_EDITOR_ZH
          ? '纹理的宽度不是2的指数,请检查!'
          : ' (The width of the texture is not a power of 2, please check!)'
      );
      return;
    }
    if (this._curve_height & (this._curve_height - 1)) {
      console.warn(
        IN_EDITOR_ZH
          ? '纹理的高度不是2的指数,请检查!'
          : ' (The height of the texture is not a power of 2, please check!)'
      );
      return;
    }

    if (this.gizmoTag == null) {
      console.warn(
        IN_EDITOR_ZH
          ? '还未指定[ 控制点纹理 ]! 拖入 [ gizmotag ] 资源即可'
          : ' ([ Control Point Texture] has not been specified yet! Drag in the [gizmotag] resource)'
      );
      // return;
    }

    // if (this.gizmoTagLine == null) {
    //   console.warn(
    //     IN_EDITOR_ZH
    //       ? '还未指定[ 控制点连接纹理 ]! 拖入 [ gizmotagline ] 资源即可'
    //       : ' ([ Control Line Texture] has not been specified yet! Drag in the [gizmotagline] resource)'
    //   );
    //   // return;
    // }

    // let c = this.node.getComponent(UIOpacity);
    // if (c) {
    //   console.warn(
    //     this.node.name +
    //       (IN_EDITOR_ZH
    //         ? ' 请去除[ UIOpacity ]组件,实际渲染忽略这个属性,如果需要透明请修改原始贴图!'
    //         : ' (Please remove the [UIOpacity] component, this property is ignored in actual rendering, if transparency is needed, please modify the original texture!)')
    //   );
    // }

    this._applySpriteFrame();
    if (this._syncOnOff && this._syncTarget) {
      //同步模式下不自身生成细分点 'In sync mode, do not generate subdivided points by itself'
    } else {
      this._vertexesSegment.length = 0;
      this._vertexesSegment = this._generateSegmentVertex(this._smoothness);
      this._updateHeadTail();
      if (this._headTailCloseOnoff && this._innerMeshSprite) {
        if (!this.node.worldPosition.equals(this.innerMeshSprite.node.worldPosition)) {
          this.innerMeshSprite.node.setWorldPosition(this.node.worldPosition);
        }
        this._innerMeshSprite.setVertexes(this._vertexesSegment);
      }
    }

    if (this._vertexesSegment.length > 0) {
      this._updateMesh();
      this.generatePhysicData();
    }

    this.markForUpdateRenderData();
  }

  //被添加到动态合图中后对已有uv数据进行转换
  public udpateUVsAfterAddedToDynamicAtlas() {
    const uv = this._spFrame.uv;
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

  private _applySpriteFrame() {
    if (this._spFrame) {
      this._curve_height_result = this._thickness == 0 ? this._curve_height : this._thickness;
      this._curve_collider_thickness = this._physicsThickness == 0 ? this._curve_height : this._physicsThickness;
      let texture = this._spFrame.texture;
      texture.setWrapMode(Texture2D.WrapMode.REPEAT, Texture2D.WrapMode.REPEAT, Texture2D.WrapMode.REPEAT);
      // let mat = this.getMaterialInstance(0) as Material;
      // let mat = this.customMaterial;

      // if (!mat || mat.effectAsset !== this._spEffectAsset) {
      //   mat = new Material();
      //   mat.initialize({
      //     effectAsset: this._spEffectAsset,
      //     defines: {
      //       USE_TEXTURE: true,
      //     },
      //   });
      //   // this.setMaterialInstance(mat, 0);
      //   this.customMaterial = mat;

      //   if (this.getSharedMaterial(0) !== this._customMaterial) {
      //     this.setSharedMaterial(this._customMaterial, 0);
      //   }
      // }
      const uv = this._spFrame.uv;
      const uv_x = uv[0]; // ul
      const uv_y = uv[1]; // vb
      const uv_w = uv[6] - uv[0]; // ur - ul
      const uv_h = uv[5] - uv[1]; // vt - vb
      const altlasUV = v4(uv_x, uv_y, uv_w, uv_h);
      // mat.setProperty('altlasUV', altlasUV, 0);
      // mat.setProperty('mainTexture', texture, 0);
    } else {
      if (!this._spFrame) {
        // let mat = this.getMaterialInstance(0) as Material;
        // mat.setProperty('mainTexture', null, 0);
      }
    }
  }

  private _getTangentPos(current: Vec3, next: Vec3, angleRad: number, thickness: number): Vec3 {
    const v1 = next
      .clone()
      .subtract(current)
      .normalize()
      .toVec2()
      .rotate(angleRad)
      .multiplyScalar(thickness)
      .add(current.toVec2());
    return v1.toVec3();
  }

  private _updateHeadTail() {
    // this._updateHead();
    // this._updateTail();
  }

  private _transfromPositonWhenScale(inpos: Vec3, targetNode: Node) {
    const localPos = inpos.clone();
    const worldMat = targetNode.getWorldMatrix();
    const worldPos = new Vec3();
    Vec3.transformMat4(worldPos, localPos, worldMat);
    const invParentMat = new Mat4();
    Mat4.invert(invParentMat, targetNode.getWorldMatrix());
    const newLocalPos = new Vec3();
    Vec3.transformMat4(newLocalPos, worldPos, invParentMat);
    return newLocalPos;
  }

  private _updateHead() {
    if (this._headTailFixedOnOff) {
      if (!this._headTailFrame) {
        console.warn(IN_EDITOR_ZH ? '请指定对应的首尾纹理' : ' (Please set the head/tail texture)');
        return;
      }
      let headNode = this.node.getChildByName('_headNode_');
      if (!headNode) {
        headNode = new Node('_headNode_');
        headNode.setParent(this.node);
      }
      headNode.setSiblingIndex(0);
      headNode.setPosition(0, 0, this.node.z);
      // headNode.setScale(this.node.scale.x, this.node.scale.y, 1);
      let meshR = headNode.getComponent(MeshRenderer);
      if (!meshR) {
        meshR = headNode.addComponent(MeshRenderer);
      }
      // let uiMeshR = this.node.getComponent(UIMeshRenderer);
      // if (!uiMeshR) {
      //   headNode.getComponent(MeshRenderer)?.destroy();
      // } else {
      //   if (!headNode.getComponent(UIMeshRenderer)) {
      //     headNode.addComponent(UIMeshRenderer);
      //   }
      // }
      let uiMeshR = headNode.getComponent(UIMeshRenderer);
      if (!uiMeshR) {
        headNode.addComponent(UIMeshRenderer);
      }

      let mat = meshR.getMaterialInstance(0) as Material;
      if (!mat) {
        mat = new Material();
        mat.initialize({
          // effectAsset: this._spEffectAsset,
          defines: {
            USE_TEXTURE: true,
          },
        });
        meshR.setMaterialInstance(mat, 0);
      }
      mat.setProperty('mainTexture', this._headTailFrame.texture, 0);
      const uv = this._headTailFrame.uv;
      const uv_x = uv[0]; // ul
      const uv_y = uv[1]; // vb
      const uv_w = uv[6] - uv[0]; // ur - ul
      const uv_h = uv[5] - uv[1]; // vt - vb
      const altlasUV = v4(uv_x, uv_y, uv_w, uv_h);
      // console.log('altlasUV', altlasUV);
      mat.setProperty('altlasUV', altlasUV, 0);

      const cur = this._vertexesSegment[0]; //.clone().multiply(this.node.scale);
      const next = this._vertexesSegment[1]; //.clone().multiply(this.node.scale);

      let p2 = cur.clone();
      let p3 = this._getTangentPos(p2, next, -Math.PI / 2, this._curve_height_result);
      let p0 = cur.clone().subtract(next).normalize().multiplyScalar(this._headTailFrame.originalSize.width).add(cur);
      let p1 = p3.clone().subtract(p2).add(p0);
      if (this._renderMode === TerrainRenderMode.TANGENT_MODE_CENTER) {
        const vAdd: Vec3 = p0.clone().subtract(p1).multiplyScalar(0.5);
        p0 = p0.add(vAdd);
        p1 = p1.add(vAdd);
        p2 = p2.add(vAdd);
        p3 = p3.add(vAdd);
      }

      let posset: number[] = [];
      let tmp: Vec3[] = [];
      tmp.push(p0, p1, p2, p3);
      for (let i = 0; i < tmp.length; i++) {
        posset.push(tmp[i].x, tmp[i].y, tmp[i].z);
      }
      let uvs = [0, 0, 0, 1, 1, 0, 1, 1];
      let indices = this.node.scale.x * this.node.scale.y > 0 ? [0, 1, 2, 1, 3, 2] : [0, 2, 1, 1, 2, 3];
      // let indices = [0, 1, 2, 1, 3, 2];
      if (headNode.scale.x * headNode.scale.y < 0) {
        indices = [0, 2, 1, 1, 2, 3];
      }
      let mesh = utils.MeshUtils.createMesh({
        positions: posset,
        uvs: uvs,
        indices: indices,
      });
      if (meshR!.mesh) {
        meshR.mesh!.destroy();
      }
      meshR.mesh = mesh;
    } else {
      let headNode = this.node.getChildByName('_headNode_');
      if (headNode) {
        headNode.destroy();
      }
    }
  }
  private _updateTail() {
    if (this._headTailFixedOnOff) {
      if (!this._headTailFrame) {
        console.warn(IN_EDITOR_ZH ? '请指定对应的首尾纹理' : ' (Please set the head/tail texture)');
        return;
      }
      let tailNode = this.node.getChildByName('_tailNode_');
      if (!tailNode) {
        tailNode = new Node('_tailNode_');
        tailNode.setParent(this.node);
      }
      tailNode.setSiblingIndex(0);
      tailNode.setPosition(0, 0, this.node.z);
      // tailNode.setScale(this.node.scale.x, this.node.scale.y, 1);
      let meshR = tailNode.getComponent(MeshRenderer);
      if (!meshR) {
        meshR = tailNode.addComponent(MeshRenderer);
      }
      // let uiMeshR = this.node.getComponent(UIMeshRenderer);
      // if (!uiMeshR) {
      //   tailNode.getComponent(MeshRenderer)?.destroy();
      // } else {
      //   if (!tailNode.getComponent(UIMeshRenderer)) {
      //     tailNode.addComponent(UIMeshRenderer);
      //   }
      // }
      let uiMeshR = tailNode.getComponent(UIMeshRenderer);
      if (!uiMeshR) {
        tailNode.addComponent(UIMeshRenderer);
      }
      let mat = meshR.getMaterialInstance(0) as Material;
      if (!mat) {
        mat = new Material();
        mat.initialize({
          // effectAsset: this._spEffectAsset,
          defines: {
            USE_TEXTURE: true,
          },
        });
        // this._headTailFrame.texture.setWrapMode(
        //   Texture2D.WrapMode.REPEAT,
        //   Texture2D.WrapMode.REPEAT,
        //   Texture2D.WrapMode.REPEAT
        // );
        meshR.setMaterialInstance(mat, 0);
      }
      mat.setProperty('mainTexture', this._headTailFrame.texture, 0);
      const uv = this._headTailFrame.uv;
      const uv_x = uv[0]; // ul
      const uv_y = uv[1]; // vb
      const uv_w = uv[6] - uv[0]; // ur - ul
      const uv_h = uv[5] - uv[1]; // vt - vb
      const altlasUV = v4(uv_x, uv_y, uv_w, uv_h);
      // console.log('altlasUV', altlasUV);
      mat.setProperty('altlasUV', altlasUV, 0);

      let p0 = this._vertexesSegment[this._vertexesSegment.length - 1].clone();
      let p1 = this._getTangentPos(
        p0,
        this._vertexesSegment[this._vertexesSegment.length - 2],
        Math.PI / 2,
        this._curve_height_result
      );
      let p2 = p0
        .clone()
        .subtract(this._vertexesSegment[this._vertexesSegment.length - 2])
        .normalize()
        .multiplyScalar(this._headTailFrame.originalSize.width)
        .add(p0);
      let p3 = p2.clone().subtract(p0).add(p1);
      if (this._renderMode === TerrainRenderMode.TANGENT_MODE_CENTER) {
        const vAdd: Vec3 = p0.clone().subtract(p1).multiplyScalar(0.5);
        p0 = p0.add(vAdd);
        p1 = p1.add(vAdd);
        p2 = p2.add(vAdd);
        p3 = p3.add(vAdd);
      }

      let posset: number[] = [];
      let tmp: Vec3[] = [];
      tmp.push(p0, p1, p2, p3);
      for (let i = 0; i < tmp.length; i++) {
        posset.push(tmp[i].x, tmp[i].y, tmp[i].z);
      }
      let uvs = [1, 0, 1, 1, 0, 0, 0, 1];
      let indices = this.node.scale.x * this.node.scale.y > 0 ? [0, 1, 2, 1, 3, 2] : [0, 2, 1, 1, 2, 3];
      let mesh = utils.MeshUtils.createMesh({
        positions: posset,
        uvs: uvs,
        indices: indices,
      });
      if (meshR!.mesh) {
        meshR.mesh!.destroy();
      }
      meshR.mesh = mesh;
    } else {
      let headNode = this.node.getChildByName('_tailNode_');
      if (headNode) {
        headNode.destroy();
      }
    }
  }
  //细分控制点,通过Catmull-Rom 样条曲线来插值平滑 'Subdivide control points, interpolate and smooth using Catmull-Rom spline'
  private _catmullRom(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
    const t2 = t * t;
    const t3 = t2 * t;

    // Catmull-Rom spline formula for 3D
    const x =
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    const y =
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
    // const z =
    //   0.5 *
    //   (2 * p1.z +
    //     (-p0.z + p2.z) * t +
    //     (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 +
    //     (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3);

    return v3(x, y, 0);
  }

  //最小分段距离 'Minimum segment length'
  private _minSegmentLength: number = 8;
  private _generateSegmentVertex(seg_count: number = 8, physics: boolean = false): Vec3[] {
    const _seg: Vec3[] = [];
    // this._vertexesSegment.length = 0;
    const points = this._controlPoints;
    const pointCount = points.length;

    if (0 === seg_count) {
      _seg.push(...points);
      physics ||
        console.log(
          this.node.name + (IN_EDITOR_ZH ? ' 细分后点数量为:' : ' (Number of points after subdivision):'),
          _seg.length
        );
      if (this._headTailCloseOnoff) {
        _seg.push(points[0].clone());
      }
      return _seg;
    }

    if (pointCount < 2) {
      if (pointCount === 1) {
        _seg.push(points[0].clone());
      }
      return _seg;
    }

    if (pointCount === 2) {
      const p0 = points[0];
      const p1 = points[1];
      _seg.push(p0.clone());
      _seg.push(p1.clone());
      return _seg;
    }

    // Catmull-Rom样条 'Catmull-Rom spline'
    const paddedPoints: Vec3[] = [];
    let interCounts = 0;
    if (this._headTailCloseOnoff) {
      paddedPoints.push(points[points.length - 1].clone());
      paddedPoints.push(...points);
      paddedPoints.push(points[0].clone());
      paddedPoints.push(points[1].clone());
      interCounts = pointCount;
    } else {
      interCounts = pointCount - 1;
      paddedPoints.push(points[0].clone().add(points[0].clone().subtract(points[1])));
      paddedPoints.push(...points);
      paddedPoints.push(
        points[pointCount - 1].clone().add(points[pointCount - 1].clone().subtract(points[pointCount - 2]))
      );
    }

    for (let i = 0; i < interCounts; i++) {
      const p0 = paddedPoints[i];
      const p1 = paddedPoints[i + 1];
      const p2 = paddedPoints[i + 2];
      const p3 = paddedPoints[i + 3];

      if (i === 0) {
        _seg.push(p1.clone());
      }

      // 计算该段的长度（用p1-p2的距离近似） 'Calculate the length of this segment (approximated by the distance between p1 and p2)'
      const dist = p1.clone().subtract(p2).length();
      let seg = seg_count;
      // 如果距离小于最小分段距离，则不分段，直接连接
      if (dist < 40) {
        seg = 1;
      } else {
        while (seg > 1 && dist / seg < this._minSegmentLength) {
          seg = Math.floor(seg / 2);
        }
      }

      const step = 1 / seg;
      for (let j = 1; j <= seg; j++) {
        const t = j * step;
        const interpolatedPoint = this._catmullRom(p0, p1, p2, p3, t);
        _seg.push(interpolatedPoint);
      }
    }

    // if (this._vertexesSegment.length > 0) {
    //   const lastOriginalPoint = points[pointCount - 1];
    //   this._vertexesSegment[this._vertexesSegment.length - 1] = lastOriginalPoint.clone();
    // }

    // // 需要在不同模式下分别考虑
    // for (let i = this._vertexesSegment.length - 1; i > 0; i--) {
    //   // if (this._vertexesSegment[i].equals(this._vertexesSegment[i - 1], 2)) {
    //   if (isCloseToVec3(this._vertexesSegment[i], this._vertexesSegment[i - 1], 2)) {
    //     this._vertexesSegment.splice(i, 1);
    //   }
    // }

    // this._vertexesSegment = this._vertexesSegment.filter(
    //   (v) => isFinite(v.x) && isFinite(v.y) && (v.x !== 0 || v.y !== 0)
    // );

    physics ||
      console.log(
        this.node.name + (IN_EDITOR_ZH ? ' 细分后点数量为:' : ' (Number of points after subdivision):'),
        _seg.length
      );
    return _seg;
  }

  private _updateMesh() {
    if (!this._spFrame || this._controlPoints.length < 2) {
      console.warn(IN_EDITOR_ZH ? '至少需要两个控制点' : 'Need at least 2 points to define.');
      // this.renderer!.mesh = null;
      return;
    }

    const positions = this._calculateVertexes();
    if (positions.length === 0) {
      console.warn(this.node.name, IN_EDITOR_ZH ? '顶点数据数量为0' : 'No vertexes calculated.');
      // this.renderer!.mesh = null;
      return;
    }

    let uvs: number[] = null;
    if (TerrainRenderUVMode.UV_REPEAT_GRID === this._renderUVMode) {
      uvs = this._calculateUVs();
    } else if (TerrainRenderUVMode.UV_REPEAT_LENGTH === this._renderUVMode) {
      uvs = this._calculateTangentsUVs();
    } else if (TerrainRenderUVMode.UV_U_FROM_0_TO_1 === this._renderUVMode) {
      uvs = this._calculateUV_X01();
    }

    const indices = this._calculateIndices();
    // const normals = this._calculateNormals();

    this._positions = positions;
    this._uvs = uvs;
    this._indices = indices;

    // this._positions = [-200, 200, 0, -200, -200, 0, 200, 200, 0, 200, -200, 0];
    // this._uvs = [0, 0, 0, 1, 1, 0, 1, 1];
    // this._indices = [0, 1, 2, 1, 3, 2];

    // let mesh = utils.MeshUtils.createMesh({
    //   positions: positions,
    //   uvs: uvs,
    //   indices: indices,
    //   // normals: normals,
    // });

    // if (this.renderer!.mesh) {
    //   this.renderer!.mesh.destroy();
    // }
    // this.renderer!.mesh = mesh;
  }

  /**
   * 计算两条线段的交点
   * @param p1 第一条线段的起点
   * @param p2 第一条线段的终点
   * @param p3 第二条线段的起点
   * @param p4 第二条线段的终点
   * @param extended 是否考虑延长线,默认false
   * @returns 交点（Vec2），如果没有交点则返回 false
   */
  private _crossPointBy2Segment(
    p1: Vec2 | Vec3,
    p2: Vec2 | Vec3,
    p3: Vec2 | Vec3,
    p4: Vec2 | Vec3,
    extended: boolean = false
  ): Vec2 {
    const a = p1,
      b = p2; // 第一条线段: a->b
    const c = p3,
      d = p4; // 第二条线段: c->d

    // 计算分母 'Calculate denominator'
    const denominator = (d.y - c.y) * (b.x - a.x) - (d.x - c.x) * (b.y - a.y);
    if (denominator === 0) return null; // 平行或共线 'Parallel or collinear'

    // 计算 ua 和 ub 'Calculate ua and ub'
    const ua = ((d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x)) / denominator;
    const ub = ((b.x - a.x) * (a.y - c.y) - (b.y - a.y) * (a.x - c.x)) / denominator;

    if (extended) {
      return v2(a.x + ua * (b.x - a.x), a.y + ua * (b.y - a.y));
    }

    // 检查交点是否在线段上 'Check if the intersection point is on the segment'
    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
      return v2(a.x + ua * (b.x - a.x), a.y + ua * (b.y - a.y));
    }

    return null;
  }

  /**
   * 计算从向量a到向量b的有符号夹角
   * @param a 起始向量
   * @param b 目标向量
   * @param normal 参考法向量（决定正方向）,默认(0,0,1)
   * @returns 夹角（范围：-π ~ π），零向量返回NaN
   */
  private _signedAngle3D(a: Vec3, b: Vec3, normal?: Vec3): number {
    // 检查零向量
    const magA = Math.sqrt(a.x ** 2 + a.y ** 2 + a.z ** 2);
    const magB = Math.sqrt(b.x ** 2 + b.y ** 2 + b.z ** 2);
    if (magA === 0 || magB === 0) return NaN;

    // 计算点积和叉积
    const dot = a.x * b.x + a.y * b.y + a.z * b.z;
    const cross = {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
    const nor = normal ? normal : v3(0, 0, 1);
    // 叉积与法向量的点积决定方向
    const crossDotNormal = cross.x * nor.x + cross.y * nor.y + cross.z * nor.z;
    const sign = Math.sign(crossDotNormal);

    // 计算无符号夹角
    const cosTheta = Math.min(1, Math.max(-1, dot / (magA * magB)));
    const unsignedAngle = Math.acos(cosTheta);

    return sign * unsignedAngle;
  }

  //根据一组控制点和一个厚度,计算TANGENT_MODE模式下的顺时针90°顶点
  private _calclateTangentPoints(indata: Vec3[], thickness: number): Vec3[] {
    thickness = thickness < 0 ? 1 : thickness;
    let pCurrentClockLast = new Vec2(0, 0);
    let pNextClockLast = new Vec2(0, 0);
    let outPoints: Vec3[] = [];
    let temp = indata;
    if (this._headTailCloseOnoff) {
      temp = indata.map((v) => v.clone());
      temp.push(temp[1].clone());
    }
    for (let index = 0; index < temp.length; index++) {
      outPoints.push(temp[index].clone());
      //使用下半距离平行线交点方式来取点
      const thick = thickness * 1.0;
      let directVec = new Vec3(0, 0, 0);
      let directNormalVec = new Vec2(0, 0);
      if (index == temp.length - 1) {
        directVec = temp[index].clone().subtract(temp[index - 1]);
        directNormalVec = directVec.clone().normalize().toVec2();
      } else {
        directVec = temp[index + 1].clone().subtract(temp[index]);
        directNormalVec = directVec.clone().normalize().toVec2();
      }
      let clockwisePoint = directNormalVec
        .clone()
        .rotate(-Math.PI / 2)
        .multiplyScalar(thick);
      let pCurrentClock = temp[index].toVec2().add(clockwisePoint);
      if (index < temp.length - 1) {
        let pNextClock = temp[index + 1].toVec2().add(clockwisePoint);
        if (index > 0) {
          const lenStand = 1.414 * thick;

          //计算顺时针交点
          let crossPointClock = this._crossPointBy2Segment(
            pCurrentClockLast,
            pNextClockLast,
            pCurrentClock,
            pNextClock,
            true
          );

          if (crossPointClock) {
            const vDir1 = crossPointClock.clone().subtract(temp[index].toVec2());
            const vDirNormal1 = vDir1.clone().normalize();
            if (vDir1.length() > lenStand && this._smoothness > 6) {
              //以前后向量垂直模式下为长度标准
              crossPointClock = vDirNormal1.clone().multiplyScalar(lenStand).add(temp[index].toVec2());
              // console.log('crossPointClock 太远,截断重置', crossPointClock);
            }
            outPoints.push(crossPointClock.toVec3());
          } else {
            console.log(`${this.node.name} 交点计算失败,交点退化为原始点`);
            outPoints.push(pCurrentClock.toVec3());
          }
        }

        pNextClockLast = pNextClock;
      }
      if (index === 0 || index === temp.length - 1) {
        outPoints.push(pCurrentClock.toVec3());
      }
      pCurrentClockLast = pCurrentClock;
    }
    if (this._headTailCloseOnoff) {
      outPoints.pop();
      outPoints.pop();
      outPoints[0] = outPoints[outPoints.length - 2];
      outPoints[1] = outPoints[outPoints.length - 1];
    }

    //对一些异常情况处理,如果控制点和顺时针点的连线和任何一段控制点线段相交,则这个顺时针点修改为这个交点
    const outPointsVec2 = outPoints.map((v) => v.toVec2());
    for (let index = 0; index < outPointsVec2.length; index += 2) {
      if (0 === index || outPointsVec2.length - 2 === index) continue;
      const pCur = outPointsVec2[index];
      const pCurClock = outPointsVec2[index + 1];
      for (let j = 0; j < outPointsVec2.length; j += 2) {
        if (outPointsVec2.length - 2 === j) continue;
        if (j === index || j === index - 2 || j === index + 2) continue;
        const pSeg0 = outPointsVec2[j];
        const pSeg1 = outPointsVec2[j + 2];
        const r = this._crossPointBy2Segment(pCur, pCurClock, pSeg0, pSeg1, false);
        if (r) {
          outPoints[index + 1].x = r.x;
          outPoints[index + 1].y = r.y;
          // console.log(`检测到索引为${index}的点的顺时针顶点异常,已修正为交点`, r);
        }
      }
    }

    return outPoints;
  }

  //根据一组控制点和一个厚度,计算TANGENT_MODE_CENTER模式下的上下顶点
  private _calclateTangentCenterPoints(indata: Vec3[], thickness: number, physics: boolean = false): Vec3[] {
    thickness = thickness < 0 ? 1 : thickness;
    let pCurrentAnticlockLast = new Vec2(0, 0);
    let pCurrentClockLast = new Vec2(0, 0);
    let pNextAnticlockLast = new Vec2(0, 0);
    let pNextClockLast = new Vec2(0, 0);
    let outPoints: Vec3[] = [];
    let temp = indata;
    if (this._headTailCloseOnoff) {
      temp = indata.map((v) => v.clone());
      temp.push(temp[1].clone());
    }
    for (let index = 0; index < temp.length; index++) {
      //使用上下半距离平行线交点方式来取点
      const halfH = thickness * 0.5;
      let directVec = new Vec3(0, 0, 0);
      let directNormalVec = new Vec2(0, 0);
      if (index == temp.length - 1) {
        directVec = temp[index].clone().subtract(temp[index - 1]);
        directNormalVec = directVec.clone().normalize().toVec2();
      } else {
        directVec = temp[index + 1].clone().subtract(temp[index]);
        directNormalVec = directVec.clone().normalize().toVec2();
      }
      let antiClockwisePoint = directNormalVec
        .clone()
        .rotate(Math.PI / 2)
        .multiplyScalar(halfH);
      let clockwisePoint = directNormalVec
        .clone()
        .rotate(-Math.PI / 2)
        .multiplyScalar(halfH);
      let pCurrentAnticlock = temp[index].toVec2().add(antiClockwisePoint);
      let pCurrentClock = temp[index].toVec2().add(clockwisePoint);

      if (index < temp.length - 1) {
        let pNextAnticlock = temp[index + 1].toVec2().add(antiClockwisePoint);
        let pNextClock = temp[index + 1].toVec2().add(clockwisePoint);
        if (index > 0) {
          //计算逆时针交点
          let crossPointAnticlock = this._crossPointBy2Segment(
            pCurrentAnticlockLast,
            pNextAnticlockLast,
            pCurrentAnticlock,
            pNextAnticlock,
            true
          );
          const lenStand = 1.414 * halfH;
          if (crossPointAnticlock) {
            const vDir = crossPointAnticlock.clone().subtract(temp[index].toVec2());
            const vDirNormal = vDir.clone().normalize();
            if (vDir.length() > lenStand && this._smoothness > 6) {
              //以前后向量垂直模式下为长度标准
              crossPointAnticlock = vDirNormal.clone().multiplyScalar(lenStand).add(temp[index].toVec2());
              // console.log('crossPointAnticlock 太远,截断重置', crossPointAnticlock);
            }
            outPoints.push(crossPointAnticlock.toVec3());
          } else {
            console.log(`${this.node.name} 交点计算失败,交点退化为原始点`);
            outPoints.push(pCurrentAnticlock.toVec3());
          }

          //计算顺时针交点
          let crossPointClock = this._crossPointBy2Segment(
            pCurrentClockLast,
            pNextClockLast,
            pCurrentClock,
            pNextClock,
            true
          );

          if (crossPointClock) {
            const vDir1 = crossPointClock.clone().subtract(temp[index].toVec2());
            const vDirNormal1 = vDir1.clone().normalize();
            if (vDir1.length() > lenStand && this._smoothness > 6) {
              //以前后向量垂直模式下为长度标准
              crossPointClock = vDirNormal1.clone().multiplyScalar(lenStand).add(temp[index].toVec2());
              // console.log('crossPointClock 太远,截断重置', crossPointClock);
            }
            outPoints.push(crossPointClock.toVec3());
          } else {
            console.log(`${this.node.name} 交点计算失败,交点退化为原始点`);
            outPoints.push(pCurrentClock.toVec3());
          }
        }

        pNextAnticlockLast = pNextAnticlock;
        pNextClockLast = pNextClock;
      }
      if (index === 0) {
        outPoints.push(pCurrentAnticlock.toVec3());
        outPoints.push(pCurrentClock.toVec3());
      }
      if (index === temp.length - 1) {
        outPoints.push(pCurrentAnticlock.toVec3());
        outPoints.push(pCurrentClock.toVec3());
      }

      pCurrentAnticlockLast = pCurrentAnticlock;
      pCurrentClockLast = pCurrentClock;
    }
    if (this._headTailCloseOnoff) {
      outPoints.pop();
      outPoints.pop();
      outPoints[0] = outPoints[outPoints.length - 2];
      outPoints[1] = outPoints[outPoints.length - 1];
    }

    // if (physics) {
    //   const evenPoints = outPoints.filter((_, idx) => idx % 2 === 0);
    //   const end = evenPoints.pop();
    //   console.log(`${this.node.name} evenPoints 1 :`, evenPoints);
    //   this._openedInsectLinesWipe(evenPoints);
    //   console.log(`${this.node.name} evenPoints 2 :`, evenPoints);
    //   const tmpPoints: Vec3[] = [];
    //   if (evenPoints.length > 12) {
    //     tmpPoints.push(evenPoints[evenPoints.length - 3]);
    //     tmpPoints.push(evenPoints[evenPoints.length - 2]);
    //     tmpPoints.push(evenPoints[evenPoints.length - 1]);
    //     tmpPoints.push(end);
    //     tmpPoints.push(evenPoints[0]);
    //     tmpPoints.push(evenPoints[1]);
    //     tmpPoints.push(evenPoints[2]);
    //     this._openedInsectLinesWipe(tmpPoints);
    //     console.log(`${this.node.name} evenPoints 3 :`, evenPoints);
    //   }
    // }

    return outPoints;
  }

  //处理一段不闭合的连续点的自相交
  // private _openedInsectLinesWipe(evenPoints: Vec2[] | Vec3[]) {
  //   for (let i = 0; i < evenPoints.length; i++) {
  //     const a = evenPoints[i];
  //     const b = evenPoints[i + 1];
  //     for (let j = i + 2; j < evenPoints.length - 1; j++) {
  //       const c = evenPoints[j];
  //       const d = evenPoints[j + 1];
  //       const p = this._crossPointBy2Segment(a, b, c, d, false);
  //       if (p) {
  //         // 替换B到C区间的点为交点P
  //         // for (let k = i + 1; k <= j; k++) {
  //         //   evenPoints[k].x = p.x;
  //         //   evenPoints[k].y = p.y;
  //         // }
  //         d.x = c.x;
  //         d.y = c.y;
  //         // 只处理一次交点，跳出
  //         // break;
  //       }
  //     }
  //   }
  // }

  private _calculateVertexes() {
    let positions: number[] = [];
    this._vertexes.length = 0;

    if (this._vertexesSegment.length < 2) {
      console.warn(this.node.name, IN_EDITOR_ZH ? '细分点数量小于2' : 'count of subdivided points is less than 2');
      return positions;
    }

    let temp: Vec3[] = [];
    for (let i = 0; i < this._vertexesSegment.length; i++) {
      const v = this._vertexesSegment[i];
      if (v) {
        temp.push(v.clone().add(this._offset));
      }
    }
    if (this._renderMode == TerrainRenderMode.VERTICAL_MODE) {
      for (let index = 0; index < temp.length; index++) {
        const item1 = temp[index];
        // const item2 = temp[index + 1];
        const item1_bottom = item1.clone().add(v3(0, -this._curve_height_result, 0));
        // const item2_bottom = item2.clone().add(v3(0, -this._curve_height_result, 0));
        this._vertexes.push(item1);
        this._vertexes.push(item1_bottom);
        // this._vertexes.push(item2);
        // this._vertexes.push(item1_bottom);
        // this._vertexes.push(item2_bottom);
        // this._vertexes.push(item2);
      }
    } else if (this._renderMode == TerrainRenderMode.TANGENT_MODE) {
      this._vertexes = this._calclateTangentPoints(temp, this._curve_height_result);
    } else if (this._renderMode == TerrainRenderMode.TANGENT_MODE_CENTER) {
      this._vertexes = this._calclateTangentCenterPoints(temp, this._curve_height_result);
    }
    // console.log(this._vertexes);

    this._vertexes.forEach((item) => {
      positions.push(item.x, item.y, item.z);
    });

    return positions;
  }

  //从开始到结束u映射为0到1
  private _calculateUV_X01() {
    let uvs: number[] = [];
    const textureWidth = this._curve_width;
    const textureHeight = this._curve_height;
    const textureSegmentLength = textureWidth;

    let index = 0;
    let last_pos_up: Vec3 | null = null;
    let length_all_up = 0;
    let current_top_u = 0;
    let max_len = 0;
    for (const pt of this._vertexesSegment) {
      // if (index % 2 == 0) {
      if (last_pos_up != null) {
        length_all_up += pt.clone().subtract(last_pos_up).length();
      }

      last_pos_up = pt;
      // }
      index += 1;
    }
    max_len = length_all_up;

    index = 0;
    last_pos_up = null;
    length_all_up = 0;
    current_top_u = 0;
    let vpt = null;
    for (const pt of this._vertexes) {
      let u = 0;
      let v = 0;

      if (index % 2 == 0) {
        vpt = this._vertexesSegment[index / 2];
        v = this._updownFix ? this._curve_height_result / textureHeight : 0;
        if (last_pos_up != null) {
          length_all_up += vpt.clone().subtract(last_pos_up).length();
          u = length_all_up / max_len;
        } else {
          u = 0;
        }
        current_top_u = u;
        last_pos_up = vpt;
      } else {
        v = this._updownFix ? 0 : this._curve_height_result / textureHeight;
        u = current_top_u;
      }

      uvs.push(u, v);
      index += 1;
    }

    return uvs;
  }

  private _calculateUVs() {
    let uvs: number[] = [];
    if (!this._spFrame || this._vertexes.length === 0 || this._vertexesSegment.length < 2) {
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

  private _calculateTangentsUVs() {
    let uvs: number[] = [];
    const textureWidth = this._curve_width;
    const textureHeight = this._curve_height;
    const textureSegmentLength = textureWidth;

    let index = 0;
    let last_pos_up: Vec3 | null = null;
    let length_all_up = 0;
    let current_top_u = 0;

    for (const pt of this._vertexes) {
      let u = 0;
      let v = 0;

      if (index % 2 == 0) {
        v = this._updownFix ? this._curve_height_result / textureHeight : 0;
        if (last_pos_up != null) {
          length_all_up += pt.clone().subtract(last_pos_up).length();
          // 直接计算重复的纹理坐标
          u = length_all_up / textureSegmentLength;
        } else {
          u = 0;
        }
        current_top_u = u;
        last_pos_up = pt;
      } else {
        v = this._updownFix ? 0 : this._curve_height_result / textureHeight;
        u = current_top_u;
      }

      uvs.push(u, v);
      index += 1;
    }

    return uvs;
  }

  private _calculateNormals() {
    let normals: number[] = [];
    const normal = v3(0, 0, 1);
    for (let i = 0; i < this._vertexes.length; i++) {
      normals.push(normal.x, normal.y, normal.z);
    }
    return normals;
  }

  private _calculateIndices() {
    const indices: number[] = [];
    const vertexCount = this._vertexes.length;
    for (let i = 0; i < vertexCount - 2; i++) {
      if (this.node.scale.x * this.node.scale.y > 0) {
        indices.push(i);
        indices.push(i % 2 == 0 ? i + 1 : i + 2);
        indices.push(i % 2 == 0 ? i + 2 : i + 1);
      } else {
        indices.push(i);
        indices.push(i % 2 == 0 ? i + 2 : i + 1);
        indices.push(i % 2 == 0 ? i + 1 : i + 2);
      }
    }
    return indices;
  }

  //-------------------提取物理多边形点------------------------ 'Extract physical polygon points'

  private _extractPolygonOutline(indata: Vec3[]) {
    if (this._renderMode == TerrainRenderMode.VERTICAL_MODE) {
      const points: Vec2[] = [];
      let d = this._vertexesSegment.map((item) => item.clone().add(this._offsetCollider).toVec2());
      points.push(...d);
      let down = d.map((item) => item.clone().add(v2(0, -this._curve_collider_thickness))).reverse();
      points.push(...down);
      return points;
    } else if (this._renderMode == TerrainRenderMode.TANGENT_MODE_CENTER) {
      //切线模式2
      let d = this._vertexesSegment.map((item) => item.clone().add(this._offsetCollider));
      let verts = this._calclateTangentCenterPoints(d, this._curve_collider_thickness, true);

      //特殊处理闭合
      // if (this._headTailCloseOnoff) {
      //这里计算物理多边形的逻辑有点绕,需要先确认按照正常的细分点得到的结果是否自交,如果自交,丢弃,不处理(尤其是凹多边形的自交和裁剪是个大问题).
      //如果自交,则直接退化到细分为1 的结果进行计算,细分为1的结果确定不会自交.
      let inner = verts.filter((_, idx) => idx % 2 === 0);
      let smoothness = this._smoothness;
      while (UsefulTools.isPolygonSelfIntersect(inner).result && smoothness > 2) {
        smoothness -= 2;
        const _seg: Vec3[] = this._generateSegmentVertex(smoothness, true);
        verts = this._calclateTangentCenterPoints(_seg, this._curve_collider_thickness, true);
        inner = verts.filter((_, idx) => idx % 2 === 0);
      }
      // }

      let pointsAnticlock: Vec2[] = [];
      let pointsClock: Vec2[] = [];
      for (let i = 0; i < verts.length; i++) {
        if (i % 2 == 0) {
          pointsAnticlock.push(verts[i].clone().add(this._offsetCollider).toVec2());
        } else {
          pointsClock.push(verts[i].clone().add(this._offsetCollider).toVec2());
        }
      }
      return pointsAnticlock.concat(pointsClock.reverse());
    } else if (this._renderMode == TerrainRenderMode.TANGENT_MODE) {
      let d = this._vertexesSegment.map((item) => item.clone().add(this._offsetCollider));
      let verts = this._calclateTangentPoints(d, this._curve_collider_thickness);

      // if (this._headTailCloseOnoff) {
      let inner = verts.filter((_, idx) => idx % 2 === 0);
      let smoothness = this._smoothness;
      while (UsefulTools.isPolygonSelfIntersect(inner).result && smoothness > 2) {
        smoothness -= 2;
        const _seg: Vec3[] = this._generateSegmentVertex(smoothness, true);
        verts = this._calclateTangentCenterPoints(_seg, this._curve_collider_thickness, true);
        inner = verts.filter((_, idx) => idx % 2 === 0);
      }
      // }

      let pointsOrigin: Vec2[] = [];
      let pointsClock: Vec2[] = [];
      for (let i = 0; i < verts.length; i++) {
        if (i % 2 == 0) {
          pointsOrigin.push(verts[i].clone().add(this._offsetCollider).toVec2());
        } else {
          pointsClock.push(verts[i].clone().add(this._offsetCollider).toVec2());
        }
      }
      return pointsOrigin.concat(pointsClock.reverse());
    }
  }

  private _NAME_OF_PHYSICSNODE: string = 'physicContainerNode';
  //同步更新物理组件数据 'Synchronize and update physical component data'
  private generatePhysicData() {
    if (!this._physcisOnOff) {
      let pnode = this.node.getChildByName(this._NAME_OF_PHYSICSNODE);
      if (pnode) {
        pnode.destroy();
      }
      return;
    }
    //将物理组件挂在一个指定的子节点上,保证这个子节点为第一个.
    let pnode = this.node.getChildByName(this._NAME_OF_PHYSICSNODE);
    if (!pnode) {
      pnode = new Node(this._NAME_OF_PHYSICSNODE);
      pnode.setSiblingIndex(0);
      this.node.addChild(pnode);
    }
    // pnode.x = 0;
    // pnode.y = 0;
    pnode.setPosition(0, 0, 0);

    this._physicsCollider = pnode.getComponent(PolygonCollider2D);
    if (!this._physicsCollider) {
      this._physicsCollider = pnode.addComponent(PolygonCollider2D);
    }
    const rigid = pnode.getComponent(RigidBody2D);
    if (!rigid) {
      const rcomp = pnode.addComponent(RigidBody2D);
      rcomp.type = ERigidBody2DType.Static;
    }

    // const indices = this._calculateIndices();
    const polygonPoints = this._extractPolygonOutline(this._vertexes);
    this._physicsCollider.points = polygonPoints;
    this._physicsCollider.apply();
  }

  //---------------------- 编辑器中编辑功能--------------- 'Edit map in editor'

  @property({})
  private _visibleOnOff: boolean = true;
  @property({
    type: CCBoolean,
    tooltip: IN_EDITOR_ZH ? '控制点显示/隐藏' : ' (Whether to display gizmo in editor)',
    displayName: IN_EDITOR_ZH ? '控制点显示/隐藏' : ' (Whether to display gizmo in editor)',
    group: IN_EDITOR_ZH ? '控制点属性' : ' (Terrain Editing Parameter Control)',
  })
  get gizmoVisibleOnOff() {
    return this._visibleOnOff;
  }
  set gizmoVisibleOnOff(value) {
    this._editNodes.forEach((item) => {
      item.active = value;
    });
    this._visibleOnOff = value;
  }

  @property({})
  private _sortInXDirection: boolean = false;
  @property({
    type: CCBoolean,
    tooltip: IN_EDITOR_ZH ? '是否在X轴方向排序' : ' (Sort in X direction)',
    displayName: IN_EDITOR_ZH ? '是否在X轴方向排序' : ' (Sort in X direction)',
    group: IN_EDITOR_ZH ? '控制点属性' : ' (Terrain Editing Parameter Control)',
  })
  get sortInXDirection() {
    return this._sortInXDirection;
  }
  set sortInXDirection(value) {
    this._sortInXDirection = value;
  }

  @property({})
  private _editWhenRun: boolean = false;
  @property({
    type: CCBoolean,
    tooltip: IN_EDITOR_ZH ? '运行时存在/不存在' : 'editWhenRun',
    displayName: IN_EDITOR_ZH ? '运行时存在/不存在' : 'editWhenRun',
    group: IN_EDITOR_ZH ? '控制点属性' : ' (Terrain Editing Parameter Control)',
  })
  get editWhenRun() {
    return this._editWhenRun;
  }
  set editWhenRun(value) {
    this._editWhenRun = value;
    // this._refreshAll();
  }

  private _registerKeyForGizmo() {
    // if (!EDITOR) return;
    // input.on(Input.EventType.KEY_DOWN, (event: EventKeyboard) => {
    //   if (event.keyCode === KeyCode.SPACE) {
    //     this._showOnOff = false;
    //     this.showOnOff = !this.showOnOff;
    //   }
    // });
  }

  @property({ type: SpriteFrame })
  private _gizmotag: SpriteFrame | null = null;
  @property({
    type: SpriteFrame,
    tooltip: IN_EDITOR_ZH ? '控制点纹理' : ' (Texture of Terrain Control Points)',
    displayName: IN_EDITOR_ZH ? '控制点纹理' : ' (Texture of Terrain Control Points)',
    group: {
      name: IN_EDITOR_ZH ? '控制点属性' : ' (Terrain Editing Parameter Control)',
      style: GROUP_STYLE_NAME,
    },
  })
  get gizmoTag() {
    return this._gizmotag;
  }
  set gizmoTag(value) {
    this._gizmotag = value;
    // this._refreshAll();
  }

  @property({})
  private _gizmoColor: Color = new Color('#9EECFF');
  @property({
    type: Color,
    tooltip: IN_EDITOR_ZH
      ? '编辑控制点时的gizmo颜色,alpha值最小值为50'
      : ' (Gizmo color when editing control points, alpha value is >=50)',
    displayName: IN_EDITOR_ZH ? '控制点颜色' : ' (Color of  Control Points)',
    group: IN_EDITOR_ZH ? '控制点属性' : ' (Points Editing Parameter Control)',
  })
  get gizmoColor() {
    return this._gizmoColor;
  }
  set gizmoColor(value) {
    let a = value.a < 50 ? 50 : value.a;
    a = value.a > 200 ? 200 : value.a;
    // console.log('gizmoColor', this._gizmoColor);
    this._gizmoColor.set(value.r, value.g, value.b, a);
    // this._refreshAll();
  }

  // @property({ type: SpriteFrame })
  // private _gizmotagline: SpriteFrame | null = null;
  // @property({
  //   type: SpriteFrame,
  //   tooltip: IN_EDITOR_ZH ? '控制点连接纹理' : ' (Texture of  Control Lines)',
  //   displayName: IN_EDITOR_ZH ? '控制点连接纹理' : ' (Texture of Control Lines)',
  //   group: {
  //     name: IN_EDITOR_ZH ? '控制点属性' : ' (Terrain Editing Parameter Control)',
  //     style: GROUP_STYLE_NAME,
  //   },
  // })
  // get gizmoTagLine() {
  //   return this._gizmotagline;
  // }
  // set gizmoTagLine(value) {
  //   this._gizmotagline = value;
  //   // this._refreshAll();
  // }

  private _editNodes: Node[] = [];
  private _lastPositionHash: string = '';
  private _lastSyncPositionHash: string = '';
  private _lastEditNodes: Node[] = null;

  private _padStart(str: string, targetLength: number, padString: string = '0'): string {
    while (str.length < targetLength) {
      str = padString + str;
    }
    return str;
  }
  private _simpleHash(s: string, len: number = 8): string {
    let hash = 5381;
    for (let i = 0; i < s.length; i++) {
      hash = (hash << 5) + hash + s.charCodeAt(i);
      hash = hash & 0xffffffff;
    }

    let hex = (hash >>> 0).toString(16);
    return this._padStart(hex, len).slice(-len);
  }
  private _normalizeAngle(angle: number): number {
    return ((angle % 360) + 360) % 360; // 将角度转化为0-360之间的值 'Convert angle to a value between 0-360'
  }
  private _angleOfVec(vin: Vec2) {
    if (!vin) return 0;
    if (vin.x == 0 && vin.y == 0) return 0;
    let ve2 = v2(vin.x, vin.y);
    let a1 = misc.radiansToDegrees(ve2.signAngle(v2(1, 0)));
    return this._normalizeAngle(-a1);
  }

  //将AssetManager.instance.loadBundle('xxx');封装为一个同步函数,使用的时候可以await调用 'Encapsulate AssetManager.instance.loadBundle('xxx') as a synchronous function, can be called with await'
  // private async loadBundleSync(bundleName: string): Promise<AssetManager.Bundle> {
  //   return new Promise((resolve, reject) => {
  //     AssetManager.instance.loadBundle(bundleName, (err, bundle) => {
  //       if (err) {
  //         console.warn('loadBundleSync error: ', err);
  //         reject(err);
  //       } else {
  //         resolve(bundle);
  //       }
  //     });
  //   });
  // }

  // private async loadResSync(bundle: AssetManager.Bundle, path: string): Promise<Asset> {
  //   return new Promise((resolve, reject) => {
  //     bundle.load(path, (err, res) => {
  //       if (err) {
  //         console.warn('loadResSync error: ', err);
  //         reject(err);
  //       } else {
  //         resolve(res);
  //       }
  //     });
  //   });
  // }

  private _checkAndAddGizmoNodesByControlPoints() {
    const cpcount = this._controlPoints.length;
    const nodecount = this._editNodes.length;
    console.log(`cpcount`, cpcount);
    console.log(`nodecount`, nodecount);
    let mstart = 0;
    let mend = cpcount;

    for (let m = mstart; m < mend; m++) {
      // console.log('新添加了一个控制点');
      let pos = this._controlPoints[m];
      const n = new Node();
      n.name = 'gizmo_' + (m + 1);
      n.setPosition(pos.x, pos.y + 1, pos.z);
      const opa = n.addComponent(UIOpacity);
      let uit = n.addComponent(UITransform);
      const spc = n.addComponent(Sprite);
      this.node.addChild(n);
      spc.spriteFrame = this._gizmotag;
      uit.setContentSize(80, 80);
      const item = n;
      let sp = item.getComponent(Sprite);
      sp.color = this.gizmoColor;
      if (this._editWhenRun) {
        n.addComponent(MoveWithTouch);
      }
    }
  }

  protected async update(dt: number): Promise<void> {
    //跟随模式下统一处理数据 'Unified data processing in follow mode'
    if (this._syncOnOff && this._syncTarget) {
      const ct = this._syncTarget.getComponent(CurveTextureAssembler);
      this._controlPoints = ct!.controlPoints;
      this._vertexesSegment = ct!.vertexesSegment;
      this._updateHeadTail();
      if (!this.node.getPosition().equals(this._syncTarget.position)) {
        this.node.setPosition(this._syncTarget.position.x, this._syncTarget.position.y);
      }
      if (this.node.getScale().x !== this._syncTarget.scale.x || this.node.getScale().y !== this._syncTarget.scale.y) {
        this.node.setScale(this._syncTarget.scale.x, this._syncTarget.scale.y, 1);
      }
      // this.node.z = this._syncTarget.z;

      const parts: string[] = [];
      this._controlPoints.forEach((item) => parts.push(`${item.x},${item.y};`));
      this._vertexesSegment.forEach((item) => parts.push(`${item.x},${item.y};`));
      let str = parts.join('');
      str += `${this._sortInXDirection}`;
      let hash = this._simpleHash(str);
      //有数据变动才刷新 'Refresh only when there is data change'
      if (hash != this._lastSyncPositionHash) {
        this._lastSyncPositionHash = hash;
        this._refreshAll('1683');
      }

      //清除控制点 'Clear control points'
      this._editNodes = this.node.children.filter((item) => item.name.startsWith('gizmo_'));
      this._editNodes.forEach((item) => {
        item.destroy();
      });
      return;
    }

    if (this._gizmotag == null) {
      // console.warn('需要提前指定gizmo的资源! 拖入 gizmoTag 资源即可' +
      // ' (Gizmo resources need to be specified in advance! Drag in gizmoTag resources)');
      return;
    }

    // if (this._gizmotagline == null) {
    //   return;
    // }

    //在编辑器中Ctrl+D,新增控制节点的时候
    if (EDITOR_NOT_IN_PREVIEW) {
      const t = this.node.children.filter((item) => item.name.startsWith('gizmo_'));
      if (this._lastEditNodes != null) {
        const newNodes = t
          .filter((node) => this._lastEditNodes.indexOf(node) === -1)
          .filter((node) => node.name.startsWith('gizmo_'));
        if (newNodes.length > 0) {
          //@ts-ignore
          // let curNodeUUID = await Editor.Selection.getLastSelected('node');
          // console.log(`curNodeUUID  `, curNodeUUID);
          //@ts-ignore
          const curNodeUUIDs = await Editor.Selection.getSelected('node');
          // console.log(`curNodeUUIDs  `, curNodeUUIDs);
          const curNodeUUID = curNodeUUIDs[curNodeUUIDs.length - 1];

          // 找到curNodeUUIDs中在_lastEditNodes出现的节点，取index最大的那个
          let maxIndex = -1;
          let curNode = null;
          let curNodeIndex = -1;
          for (const uuid of curNodeUUIDs) {
            const idx = this._lastEditNodes.findIndex((item) => item.uuid === uuid);
            if (idx > maxIndex) {
              maxIndex = idx;
              curNode = this._lastEditNodes[idx];
              curNodeIndex = idx;
            }
          }

          let preNode = this._lastEditNodes[curNodeIndex - 1];
          let nextNode = this._lastEditNodes[curNodeIndex + 1];
          let vdirNormal = v2(1, 0);
          if (nextNode) {
            // console.log(`nextNode 节点: ${nextNode.name}`);
            vdirNormal = nextNode.getPosition().clone().subtract(curNode.getPosition()).toVec2().normalize();
          } else if (preNode) {
            // console.log(`preNode 节点: ${preNode.name}`);
            vdirNormal = curNode.getPosition().clone().subtract(preNode.getPosition()).toVec2().normalize();
          }

          if (curNode) {
            let len = 150;
            if (nextNode) {
              len = nextNode.getPosition().clone().subtract(curNode.getPosition()).length();
              len = len / (newNodes.length + 1);
            }
            let sindex = curNode.getSiblingIndex();
            newNodes.forEach((item, index) => {
              // console.log(`设置 newNode : ${item.name}`);
              item.setSiblingIndex(sindex + 1); // siblingIndex会在每次设置后重新计算
              sindex = item.getSiblingIndex();
              const extenLen = len * (index + 1);
              item.setPosition(
                curNode
                  .getPosition()
                  .toVec2()
                  .add(vdirNormal.clone().multiplyScalar(extenLen))
                  .add(v2(0, 4 * (index + 1)))
                  .toVec3()
              );
            });
          }
        }
      }
      this._lastEditNodes = t;
    }

    this._editNodes.length = 0;
    this._editNodes = this.node.children.filter((item) => item.name.startsWith('gizmo_'));

    if (!this._editWhenRun && !EDITOR_NOT_IN_PREVIEW) {
      this._editNodes.forEach((element) => {
        element.destroy();
      });
      return;
    }

    //初始自动添加编辑控制节点 'Initially automatically add editing control nodes'
    if (this._editNodes.length <= 0) {
      this._checkAndAddGizmoNodesByControlPoints();
    } else if (this._editNodes.length <= 1) {
      // this._checkAndAddGizmoNodesByControlPoints(false);
      this.scheduleOnce(() => {
        this._editNodes.length = 0;
        this._controlPoints.length = 0;
        this._controlPoints.push(v3(200, 200, 0));
        this._controlPoints.push(v3(400, 300, 0));
      }, 0);
    }
    //实时控制节点显示效果 'Real-time control node display effect'
    for (let i = 0; i < this._editNodes.length; i++) {
      const item = this._editNodes[i];
      let uit = item.getComponent(UITransform);
      uit.setContentSize(80, 80);
      let opa = item.getComponent(UIOpacity);
      opa.opacity = 255;
      let sp = item.getComponent(Sprite);
      sp.color = this.gizmoColor;
      sp.spriteFrame = this._gizmotag;
      if (this._editWhenRun) {
        if (item.getComponent(MoveWithTouch) == null) {
          item.addComponent(MoveWithTouch);
        }
      } else {
        const mtouch = item.getComponent(MoveWithTouch);
        if (mtouch) {
          mtouch.destroy();
        }
      }
    }

    if (this._sortInXDirection) {
      //将所有子节点按照X增序排列 'Sort all child nodes in ascending order of X'
      this._editNodes.sort((a, b) => {
        const posA = a.getPosition();
        const posB = b.getPosition();
        return posA.x - posB.x;
      });
      this._editNodes.forEach((item, index) => {
        item.setSiblingIndex(index + 10);
      });
    }

    // for (let i = 1; i < this._editNodes.length; i++) {
    //   const pre = this._editNodes[i - 1];
    //   const cur = this._editNodes[i];
    //   const prePos = pre.getPosition();
    //   const curPos = cur.getPosition();
    //   if (prePos.x == curPos.x) {
    //     cur.setPosition(curPos.x + 120, curPos.y, curPos.z);
    //   }
    // }

    for (let j = 0; j < this._editNodes.length; j++) {
      const cur = this._editNodes[j];
      if (j == this._editNodes.length - 1) {
        if (this._headTailCloseOnoff) {
        } else {
          cur.angle = 0;
          break;
        }
      }
      let next = this._editNodes[j + 1];
      if (this._headTailCloseOnoff && j === this._editNodes.length - 1) {
        next = this._editNodes[0];
      }
      const curPos = cur.getPosition();
      const nextPos = next.getPosition();
      const ang = this._angleOfVec(nextPos.clone().subtract(curPos).toVec2());
      cur.angle = ang;
    }

    if (this._sortInXDirection) {
      //再次按照x增序排列 'Sort again in ascending order of x'
      this._editNodes.sort((a, b) => {
        const posA = a.getPosition();
        const posB = b.getPosition();
        return posA.x - posB.x;
      });
      this._editNodes.forEach((item, index) => {
        item.setSiblingIndex(index + 10);
      });
    }

    let str = '';
    this._editNodes.forEach((item) => {
      const pos = item.getPosition();
      str += `${pos.x},${pos.y},${pos.z};`;
    });
    let hash = this._simpleHash(str);
    if (this._lastPositionHash.length === 0) {
      this._lastPositionHash = hash;
    }
    if (hash !== this._lastPositionHash) {
      this._lastPositionHash = hash;
      this._controlPoints.length = 0;
      this._editNodes.forEach((item) => {
        const pos = item.getPosition();
        this._controlPoints.push(pos);
      });
      this._refreshAll('1567');
    }
  }
}

const curveTextureAssemblerImpl = new CurveTextureAssemblerImpl();
const curveTextureAssemblerImplMgr: IAssemblerManager = {
  getAssembler(comp: CurveTextureAssembler): IAssembler {
    let assembler: IAssembler = curveTextureAssemblerImpl;
    return assembler;
  },
};

CurveTextureAssembler.Assembler = curveTextureAssemblerImplMgr;
