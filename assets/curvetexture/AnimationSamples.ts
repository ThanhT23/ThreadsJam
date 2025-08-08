import { _decorator, Component, Node, Vec3 } from "cc";
import { RopeWaveAnimation } from "./animations/RopeWaveAnimation";
const { ccclass, property, executeInEditMode } = _decorator;

@ccclass("AnimationSamples")
@executeInEditMode
export class AnimationSamples extends Component {
    @property([Node])
    private _anodes: [] = [];
    @property([Node])
    get anodes() {
        return this._anodes;
    }
    set anodes(value: []) {
        this._anodes = value;
    }

    private _waveAmplitude: number = 60; // 波动幅度
    private _waveFrequency: number = 2; // 波动频率
    private _waveSpeed: number = 2; // 波动速度
    private _time: number = 0;

    private _ropeWaveAnim = new RopeWaveAnimation();

    start() {}

    update(deltaTime: number) {
        this._ropeWaveAnim.update(this._anodes, deltaTime);
    }
}
