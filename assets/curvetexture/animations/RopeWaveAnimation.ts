import { Node, Vec3 } from "cc";

export class RopeWaveAnimation {
    private _waveAmplitude: number;
    private _waveFrequency: number;
    private _waveSpeed: number;
    private _waveDirection: Vec3;
    private _time: number = 0;

    constructor(amplitude = 20, frequency = 2, speed = 16, direction: Vec3 = new Vec3(1, 0, 0)) {
        this._waveAmplitude = amplitude;
        this._waveFrequency = frequency;
        this._waveSpeed = speed;
        this._waveDirection = direction.clone().normalize();
    }

    setWaveDirection(dir: Vec3) {
        this._waveDirection = dir.clone().normalize();
    }

    public update(nodes: Node[], deltaTime: number) {
        if (!nodes || nodes.length < 2) return;

        this._time += deltaTime;

        const n = nodes.length;
        const startNode = nodes[0];
        const endNode = nodes[n - 1];
        const startPos = startNode.position.clone();
        const endPos = endNode.position.clone();

        for (let i = 1; i < n - 1; i++) {
            const t = i / (n - 1);
            // if (i %2  === 0) {}
            const pos = new Vec3(
                startPos.x + (endPos.x - startPos.x) * t,
                startPos.y + (endPos.y - startPos.y) * t,
                startPos.z + (endPos.z - startPos.z) * t
            );
            const wave = Math.sin(this._waveFrequency * t * Math.PI * 2 + this._waveSpeed * this._time);
            // 沿指定方向叠加波动
            pos.add(this._waveDirection.clone().multiplyScalar(wave * this._waveAmplitude));
            nodes[i].setPosition(pos);
        }
    }
}
