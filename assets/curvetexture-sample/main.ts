import {
  _decorator,
  Component,
  EPhysics2DDrawFlags,
  EventKeyboard,
  input,
  Input,
  KeyCode,
  Label,
  Node,
  PhysicsSystem2D,
  sys,
  screen,
  director,
  View,
  ResolutionPolicy,
  JsonAsset,
  resources,
  AudioClip,
  AudioSource,
  Camera,
} from 'cc';
import { CheckButton } from './CheckButton';
import { UsefulTools } from '../curvetexture/UsefulTools';
const { ccclass, property } = _decorator;

@ccclass('main')
export class main extends Component {
  // @property({ type: CheckButton })
  // checkButton1: CheckButton | null = null;
  @property({ type: CheckButton })
  checkButton2: CheckButton | null = null;

  @property({ type: CheckButton })
  checkButton3: CheckButton | null = null;

  // @property({ type: Label })
  // label: Label | null = null;

  @property({ type: Camera })
  camera: Camera | null = null;

  protected onLoad(): void {
    // console.log(`main onLoad`);
    this.node.layer = UsefulTools.checkAndAddLayerByName('PERSISIT');
    this.node.walk((node: Node) => {
      node.layer = UsefulTools.checkAndAddLayerByName('PERSISIT');
    });
    if (this.camera) {
      this.camera.visibility = UsefulTools.checkAndAddLayerByName('PERSISIT');
    }
  }

  protected async onEnable() {
    if (!director.isPersistRootNode(this.node)) {
      director.addPersistRootNode(this.node);
    }
    // let checkMoveTouch = (child: Node) => {
    //   if (child.name.startsWith('gizmo_')) {
    //     let c = child.getComponent(MoveWithTouch);
    //     if (!c) {
    //       c = child.addComponent(MoveWithTouch);
    //     }
    //   }
    // };

    // let cts = this.node.getComponentsInChildren(CurveTexture);
    // cts.forEach((ct) => {
    //   ct.node.children.forEach((child) => {
    //     checkMoveTouch(child);
    //   });
    // });

    // this.checkButton1.bindFunction((from: CheckButton) => {
    //   cts.forEach((ct) => {
    //     ct.editWhenRun = from.onoff;
    //     if (ct.editWhenRun) {
    //       //等这一帧控制节点生成后再设置
    //       this.scheduleOnce(() => {
    //         cts.forEach((ct) => {
    //           ct.node.children.forEach((child) => {
    //             checkMoveTouch(child);
    //           });
    //         });
    //       }, 1 / 60);
    //     }
    //   });
    // });

    this.checkButton2.bindFunction((from: CheckButton) => {
      //不能在EPhysics2DDrawFlags.None和其他值之间切换,引擎代码健壮性不够,会报错
      PhysicsSystem2D.instance.debugDrawFlags = from.onoff ? EPhysics2DDrawFlags.Shape : EPhysics2DDrawFlags.Controller;
    });

    this.checkButton3.bindFunction((from: CheckButton) => {
      director.loadScene('scene_START');
    });

    // input.on(Input.EventType.KEY_DOWN, (event: EventKeyboard) => {
    //   if (event.keyCode === KeyCode.KEY_I) {
    //     // this.node_ct.getComponent(CurveTexture)!.debugPrint();
    //     // this.node_ct2.getComponent(CurveTexture)!.debugPrint();
    //   }
    // });

    //     if (sys.language !== 'zh') {
    //       this.label.string = `1: Need to enable feature cropping => 3D => 3D base features
    // 2: Need to enable preferences => Lab => Keep the scenario main loop running
    // 3: A physical property is a PolygonCollider2D component added on a child node of a specific name
    // `;
    //     } else {
    //       this.label.string = `1:需要开启  功能裁剪 => 3D  => 3D基础功能
    // 2:需要开启  偏好设置 => 实验室  => 保持场景主循环运行
    // 3:物理属性是在子节点上添加的 PolygonCollider2D 组件`;
    //     }
  }

  start() {}

  update(deltaTime: number) {}
}
