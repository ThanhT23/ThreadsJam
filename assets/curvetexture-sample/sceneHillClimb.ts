import { _decorator, Camera, Component, director, EPhysics2DDrawFlags, Node, PhysicsSystem2D } from 'cc';
import { CheckButton } from './CheckButton';
const { ccclass, property } = _decorator;

@ccclass('sceneHillClimb')
export class sceneHillClimb extends Component {
  // @property(CheckButton)
  // checkButton: CheckButton = null!;

  @property(Node)
  nodeCamera: Node = null;

  @property(Node)
  nodeCarBody: Node = null;
  // @property(CheckButton)
  // checkButton3: CheckButton = null!;

  protected onEnable(): void {
    console.log(this.nodeCarBody.getWorldPosition());
    // this.checkButton.bindFunction((from: CheckButton) => {
    //   PhysicsSystem2D.instance.debugDrawFlags = from.onoff
    //     ? EPhysics2DDrawFlags.Shape | EPhysics2DDrawFlags.Joint
    //     : EPhysics2DDrawFlags.Controller;

    //   this.scheduleOnce(() => {
    // const debugDrawNode = this.node.getChildByName('PHYSICS_2D_DEBUG_DRAW');
    // if (debugDrawNode) {
    //   debugDrawNode.layer = this.nodeCarBody.layer;
    // }
    //   }, 1 / 60);
    // });

    // this.checkButton3.bindFunction((from: CheckButton) => {
    //   director.loadScene('scene-sample-curvetexture');
    // });
  }

  start() {}
  protected lateUpdate(dt: number): void {
    const debugDrawNode = this.node.getChildByName('PHYSICS_2D_DEBUG_DRAW');
    if (debugDrawNode) {
      debugDrawNode.layer = this.nodeCarBody.layer;
    }
  }

  update(deltaTime: number) {
    //让相机跟随车体 ,要注意坐标转换
    const carpos = this.nodeCarBody.getWorldPosition();
    // console.log('carpos', carpos);
    this.nodeCamera.setWorldPosition(carpos.x + 300, carpos.y, this.nodeCamera.getWorldPosition().z);

    const currentPos = this.nodeCamera.getWorldPosition();
    const targetX = carpos.x + 300;
    const lerpFactor = 0.2;
    const newX = currentPos.x + (targetX - currentPos.x) * lerpFactor;
    const targetY = carpos.y;
    const newY = currentPos.y + (targetY - currentPos.y) * lerpFactor;
    this.nodeCamera.setWorldPosition(newX, newY, currentPos.z);
  }
}
