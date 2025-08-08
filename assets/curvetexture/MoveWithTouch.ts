import { _decorator, Component, EventKeyboard, EventTouch, input, Input, KeyCode, Node, UITransform, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('MoveWithTouch')
// @executeInEditMode
export class MoveWithTouch extends Component {
  private _isFocused = false;
  private _fcheck: (target: Node) => boolean;
  protected onLoad(): void {
    // console.log(this.node.name + ' onLoad');
    let uiTransform = this.node.getComponent(UITransform);
    if (!uiTransform) {
      // uiTransform = this.node.addComponent(UITransform);
      // uiTransform.setContentSize(100, 100);
    } else {
      // if (uiTransform.width < 100 && uiTransform.height < 100) {
      //   uiTransform.setContentSize(100, 100);
      //   console.log(this.node.name + 'UITransform组件宽高均小于100,设置为100');
      // }
    }
  }

  protected onEnable(): void {
    this.node.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);

    // input.on(Input.EventType.KEY_DOWN, (event: EventKeyboard) => {
    //   // console.log('keyCode', event.keyCode);
    //   if (event.keyCode === KeyCode.KEY_D) {
    //     let b = false;
    //     if (this._fcheck) {
    //       b = this._fcheck(this.node);
    //     }
    //     if (b && this._isFocused && this.isValid) {
    //       this.node.destroy();
    //     }
    //   }
    // });
  }

  protected onDisable(): void {
    this.node.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
    this.node.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
  }

  update(deltaTime: number) {}

  onTouchStart(event: EventTouch) {
    this._isFocused = true;
    // console.log(this.node.name + ' onTouchStart' );
  }

  onTouchMove(event: EventTouch) {
    // const touchPos = event.getUILocation();
    // const prePos = event.getPreviousLocation();

    let delta = event.getUIDelta();
    let now = event.target.getPosition();
    event.target.setPosition(now.add(new Vec3(delta.x, delta.y, 0)));
  }

  onTouchEnd(event: any) {
    this._isFocused = false;
  }

  setCheck(check: (target: Node) => boolean) {
    this._fcheck = check;
  }
}
