/*
    临时测试用 check按钮    
*/

import { _decorator, Color, Component, EventTouch, Input, Label, Node, Sprite } from 'cc';
import { UsefulTools } from '../curvetexture/UsefulTools';
const { ccclass, property } = _decorator;

@ccclass('CheckButton')
export class CheckButton extends Component {
  @property(Node)
  node_desc: Node | null = null;

  private _onoff = false;
  private _func: (from: CheckButton) => void;
  get onoff() {
    return this._onoff;
  }
  // set onoff(value: boolean) {
  //   this._onoff = value;
  //   this.refreshByOnOff();
  // }

  protected onLoad(): void {}

  protected onEnable(): void {
    let node = this.node;
    node.on(Input.EventType.TOUCH_START, this.onTouchStart, this);
    node.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    node.on(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);

    this.refreshByOnOff();
  }

  protected onDisable(): void {
    this.node.off(Input.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.off(Input.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
  }

  start() {}

  refreshByOnOff() {
    this.node.setScale(1, 1, 1);
    this.node.getComponent(Sprite)!.color = new Color().fromHEX('#092b00');
    this.node_desc.getComponent(Label)!.color = new Color().fromHEX('#f4ffb8');
    if (this._target && this._propertyKey) {
      this.node_desc.getComponent(Label)!.color = this._onoff
        ? new Color().fromHEX('#f4ffb8')
        : new Color().fromHEX('#666666');
    }
  }

  private _target: any = null;
  private _propertyKey: string | null = null;

  // 绑定外部目标和对象
  bindData(target: any, propertyKey: string) {
    if (!target || !propertyKey) {
      console.error('CheckButton bind error: target or propertyKey is null');
      return;
    }
    const v1 = (UsefulTools.isGetter(target, propertyKey) as boolean) || target[propertyKey] != undefined;
    if (!v1) {
      console.error(`CheckButton bind error: target does not have property or getter ${propertyKey}`);
      return;
    }
    const v = target[propertyKey];
    if (typeof v !== 'boolean') {
      console.error(`CheckButton bind error: target property ${propertyKey} is not boolean`);
      return;
    }
    this._target = target;
    this._propertyKey = propertyKey;
    this.refreshByOnOff();
  }

  update(deltaTime: number) {
    if (this._target && this._propertyKey) {
      const value = this._target[this._propertyKey];
      if (this._onoff !== value) {
        this._onoff = value;
        this.refreshByOnOff();
      }
    }
  }

  bindFunction(func: (from: CheckButton) => void) {
    if (typeof func !== 'function') {
      console.error('CheckButton bindFunction error: func is not a function');
      return;
    }
    this._func = func;
  }

  onTouchStart(event: EventTouch) {
    this.node.setScale(0.98, 0.98, 1);
    this.node.getComponent(Sprite)!.color = Color.GRAY;
  }

  onTouchEnd(event: any) {
    this._onoff = !this._onoff;
    this.refreshByOnOff();

    if (this._target && this._propertyKey) {
      this._target[this._propertyKey] = this._onoff;
    }

    if (this._func) {
      this._func(this);
    }
  }

  onTouchCancel(event: EventTouch) {
    this.refreshByOnOff();
  }

  protected onDestroy(): void {}
}
