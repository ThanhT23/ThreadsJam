import { _decorator, Component, director, Node } from 'cc';
import { CheckButton } from './CheckButton';
const { ccclass, property } = _decorator;

@ccclass('scene_Start')
export class scene_Start extends Component {
  @property(CheckButton)
  checkButton1: CheckButton = null!;

  @property(CheckButton)
  checkButton2: CheckButton = null!;

  @property(CheckButton)
  checkButton3: CheckButton = null!;
  @property(CheckButton)
  checkButton4: CheckButton = null!;

  @property(CheckButton)
  checkButton5: CheckButton = null!;

  @property(CheckButton)
  checkButton6: CheckButton = null!;

  @property(CheckButton)
  checkButton7: CheckButton = null!;

  protected onEnable(): void {
    this.checkButton1.bindFunction((from: CheckButton) => {
      // 绑定函数逻辑
      console.log('CheckButton1 toggled:', from.onoff);
      director.loadScene('scene_BASE1');
    });

    this.checkButton2.bindFunction((from: CheckButton) => {
      // 绑定函数逻辑
      console.log('CheckButton2 toggled:', from.onoff);
      director.loadScene('scene_BASE2');
    });

    this.checkButton3.bindFunction((from: CheckButton) => {
      // 绑定函数逻辑
      console.log('CheckButton3 toggled:', from.onoff);
      director.loadScene('scene_HILLCLIMB');
    });
    this.checkButton4.bindFunction((from: CheckButton) => {
      // 绑定函数逻辑
      console.log('checkButton4 toggled:', from.onoff);
      director.loadScene('scene_ROPE');
    });

    this.checkButton5.bindFunction((from: CheckButton) => {
      // 绑定函数逻辑
      console.log('CheckButton5 toggled:', from.onoff);
      director.loadScene('scene_CLOSEDAREA');
    });
    this.checkButton6.bindFunction((from: CheckButton) => {
      // 绑定函数逻辑
      console.log('CheckButton6 toggled:', from.onoff);
      director.loadScene('scene_DRAGPIPE');
    });
    this.checkButton7.bindFunction((from: CheckButton) => {
      // 绑定函数逻辑
      console.log('CheckButton7 toggled:', from.onoff);
      director.loadScene('scene_AnimationRope');
    });
  }

  update(deltaTime: number) {}
}
