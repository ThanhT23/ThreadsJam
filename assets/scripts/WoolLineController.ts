import { _decorator, Component, Node, Material, Vec3, Tween, tween, math, Graphics, Color, UITransform, color } from "cc";
const { ccclass, property } = _decorator;

// Custom AnimationCurve implementation for Cocos Creator
class CustomKeyframe {
    time: number;
    value: number;
    inTangent: number;
    outTangent: number;

    constructor(time: number = 0, value: number = 0, inTangent: number = 0, outTangent: number = 0) {
        this.time = time;
        this.value = value;
        this.inTangent = inTangent;
        this.outTangent = outTangent;
    }
}

class CustomAnimationCurve {
    keyFrames: CustomKeyframe[];

    constructor(keyframes: CustomKeyframe[] = []) {
        this.keyFrames = keyframes;
        if (this.keyFrames.length === 0) {
            this.keyFrames.push(new CustomKeyframe(0, 0));
            this.keyFrames.push(new CustomKeyframe(1, 0));
        }
    }

    evaluate(time: number): number {
        if (this.keyFrames.length === 0) return 0;
        if (this.keyFrames.length === 1) return this.keyFrames[0].value;

        // Clamp time between first and last keyframe
        time = math.clamp01(time);

        // Find the two keyframes to interpolate between
        let startKey: CustomKeyframe = this.keyFrames[0];
        let endKey: CustomKeyframe = this.keyFrames[this.keyFrames.length - 1];

        for (let i = 0; i < this.keyFrames.length - 1; i++) {
            if (time >= this.keyFrames[i].time && time <= this.keyFrames[i + 1].time) {
                startKey = this.keyFrames[i];
                endKey = this.keyFrames[i + 1];
                break;
            }
        }

        // Calculate normalized time between the two keyframes
        const keyTime = (time - startKey.time) / (endKey.time - startKey.time);

        // Hermite interpolation using tangents
        return this.hermiteInterpolate(startKey.value, endKey.value, startKey.outTangent, endKey.inTangent, keyTime);
    }

    private hermiteInterpolate(y0: number, y1: number, tangent0: number, tangent1: number, t: number): number {
        const t2 = t * t;
        const t3 = t2 * t;

        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        return h00 * y0 + h10 * tangent0 + h01 * y1 + h11 * tangent1;
    }

    addKey(time: number, value: number): void {
        this.keyFrames.push(new CustomKeyframe(time, value));
        this.keyFrames.sort((a, b) => a.time - b.time);
    }

    moveKey(index: number, keyframe: CustomKeyframe): void {
        if (index >= 0 && index < this.keyFrames.length) {
            this.keyFrames[index] = keyframe;
        }
    }
}

@ccclass("WoolLineController")
export class WoolLineController extends Component {
    @property(Boolean)
    isBridging: boolean = false;

    @property(Material)
    material: Material = null;

    @property(Node)
    startPoint: Node = null; // First point (A)

    @property(Node)
    endPoint: Node = null; // Second point (B)

    @property(Node)
    myEndPoint: Node = null; // Use when filling

    @property(Node)
    myStartPoint: Node = null; // Use when filling

    @property(CustomAnimationCurve)
    curve: CustomAnimationCurve = new CustomAnimationCurve([new CustomKeyframe(0, 0), new CustomKeyframe(1, 0)]);

    @property(CustomAnimationCurve)
    heighCurve: CustomAnimationCurve = new CustomAnimationCurve([new CustomKeyframe(0, 0), new CustomKeyframe(1, 0)]);

    // Curve Settings
    @property({ group: "Curve Settings" })
    resolution = 30; // Number of points in the curve

    @property({ group: "Curve Settings" })
    curveWidth = 2; // Maximum curve deviation in the XZ plane

    // Random Tangent Settings
    @property({ group: "Random Tangent Settings" })
    minTangentValue = -2; // Minimum random tangent value

    @property({ group: "Random Tangent Settings" })
    maxTangentValue = 2; // Maximum random tangent value

    @property({ group: "Random Tangent Settings" })
    minTangentValue2 = -2; // Minimum random tangent value

    @property({ group: "Random Tangent Settings" })
    maxTangentValue2 = 2; // Maximum random tangent value

    @property({ group: "Random Tangent Settings" })
    transitionTime = 3; // Time for each transition

    // Reveal & Disappear Settings
    @property({ group: "Reveal & Disappear Settings" })
    revealDuration = 2; // Time to fully draw the line at start

    @property({ group: "Reveal & Disappear Settings" })
    disappearDuration = 2; // Time to fully remove the line

    // Private variables
    private graphics: Graphics = null; // Graphics component for drawing lines
    private targetCurve: CustomAnimationCurve = null;
    private revealProgress: number = 0; // 0 to 1 (progress of reveal/disappear)
    private isDisappearing: boolean = false;
    private lineColor: Color = Color.WHITE;

    @property(Number)
    newOutTangent1 = 0;

    @property(Number)
    newInTangent2 = 0;

    @property(Number)
    timeBridging = 0;

    @property(Vec3)
    offsetStartPoint: Vec3 = new Vec3();

    @property(Vec3)
    offsetEndPoint: Vec3 = new Vec3();

    @property(Vec3)
    offsetAtBackSlot: Vec3 = new Vec3();

    // Line positions array for drawing
    private linePositions: Vec3[] = [];

    start() {
        // Initialize Graphics component for drawing lines
        this.graphics = this.getComponent(Graphics);
        if (!this.graphics) {
            this.graphics = this.addComponent(Graphics);
        }
        this.graphics.lineWidth = 10;
        this.graphics.strokeColor = this.lineColor;

        this.targetCurve = new CustomAnimationCurve(this.curve.keyFrames);

        this.jumping(color(), this.startPoint, this.endPoint);
    }

    onEnable() {}

    stop() {
        this.unscheduleAllCallbacks();
        if (this.graphics) {
            this.graphics.clear(); // Clear all graphics
        }
        this.linePositions = []; // Fully disappear
        this.isDisappearing = false;
        this.isBridging = false;
    }

    bridging() {
        this.isBridging = true;
        this.unscheduleAllCallbacks();

        // Modify curve keyframes
        const keys = this.curve.keyFrames;
        if (keys.length >= 2) {
            keys[0].outTangent = this.newOutTangent1 * (Math.random() > 0.5 ? 1 : -1);
            keys[1].inTangent = this.newInTangent2 * (Math.random() > 0.5 ? 1 : -1);
        }

        this.revealLine(); // Start initial drawing animation
        this.updateCurveOverTime(); // Start smooth tangent transitions
    }

    jumping(color: Color, startPos: Node, endPos: Node) {
        this.isBridging = true;

        // Set line color
        this.lineColor = color;
        if (this.graphics) {
            this.graphics.strokeColor = color;
        }

        this.startPoint = startPos;
        this.endPoint = endPos;
        this.bridging();
    }

    bridgingNoneCurve() {
        this.unscheduleAllCallbacks();

        const keys = this.curve.keyFrames;
        if (keys.length >= 2) {
            keys[0].outTangent = this.newOutTangent1 * (Math.random() > 0.5 ? 1 : -1);
            keys[1].inTangent = this.newInTangent2 * (Math.random() > 0.5 ? 1 : -1);
        }

        this.revealLineNoneCurve(); // Start initial drawing animation
        this.updateCurveNoneHeightCurveOverTime(); // Start smooth tangent transitions
    }

    jumpingNoneCurve(color: Color, startPos: Node, endPos: Node) {
        this.isBridging = true;

        this.lineColor = color;
        if (this.graphics) {
            this.graphics.strokeColor = color;
        }

        this.startPoint = startPos;
        this.endPoint = endPos;
        this.bridgingNoneCurve();
    }

    fillingJump(color: Color, eatingSpool: Node) {
        console.log("Set color:", color);
        this.isBridging = true;

        this.lineColor = color;
        if (this.graphics) {
            this.graphics.strokeColor = color;
        }

        this.startPoint = eatingSpool;
        this.endPoint = this.myEndPoint;
        this.filling();
    }

    filling() {
        this.unscheduleAllCallbacks();

        const keys = this.curve.keyFrames;
        if (keys.length >= 2) {
            const padding = 100;
            keys[0].outTangent = this.newOutTangent1 * (Math.random() * 4 * padding - 2 * padding); // Range -2 to 2
            keys[1].inTangent = this.newInTangent2 * (Math.random() * 4 * padding - 2 * padding);
        }

        this.revealLine(); // Start initial drawing animation
        this.updateCurveOverTimeFilling(); // Start smooth tangent transitions
    }

    setMyEndPointPosition(newPosition: Vec3) {
        if (this.myEndPoint) {
            this.myEndPoint.setWorldPosition(newPosition);
        }
    }

    setMyStartPosition(newStartPosition: Vec3) {
        if (this.myStartPoint) {
            this.myStartPoint.setWorldPosition(newStartPosition);
        }
    }

    updateCurve() {
        if (!this.startPoint || !this.endPoint) return;

        const visiblePoints = Math.floor(this.resolution * this.revealProgress);
        this.linePositions = new Array(visiblePoints);

        const startPos = this.startPoint.getWorldPosition().clone().add(this.offsetStartPoint);
        const endPos = this.endPoint.getWorldPosition().clone().subtract(this.offsetEndPoint);
        const direction = endPos.clone().subtract(startPos).normalize();

        const perpendicular = new Vec3(direction.x, -direction.y, 0).multiplyScalar(this.curveWidth);

        if (this.isDisappearing) {
            for (let i = visiblePoints - 1; i >= 0; i--) {
                const t = i / (this.resolution - 1);
                const curveOffset = this.curve.evaluate(t);
                const heightOffset = this.heighCurve.evaluate(t);

                const point = Vec3.lerp(new Vec3(), endPos, startPos, t)
                    .add(perpendicular.clone().multiplyScalar(curveOffset))
                    .add(new Vec3(0, heightOffset, 0));

                this.linePositions[i] = point;
            }
        } else {
            for (let i = 0; i < visiblePoints; i++) {
                const t = i / (this.resolution - 1);
                const curveOffset = this.curve.evaluate(t);
                const heightOffset = this.heighCurve.evaluate(t);

                const point = Vec3.lerp(new Vec3(), startPos, endPos, t)
                    .add(perpendicular.clone().multiplyScalar(curveOffset))
                    .add(new Vec3(0, heightOffset, 0));

                this.linePositions[i] = point;
            }
        }

        // Update line renderer with positions
        this.updateLineRenderer();
    }

    updateCurveNoneHeightCurve() {
        if (!this.startPoint || !this.endPoint) return;

        const visiblePoints = Math.floor(this.resolution * this.revealProgress);
        this.linePositions = new Array(visiblePoints);

        const startPos = this.startPoint.worldPosition.clone().add(this.offsetStartPoint).add(this.offsetAtBackSlot);
        const endPos = this.endPoint.worldPosition.clone().subtract(this.offsetEndPoint);
        const direction = endPos.clone().subtract(startPos).normalize();

        const perpendicular = new Vec3(-direction.z, 0, direction.x).multiplyScalar(this.curveWidth);
        const distance = Vec3.distance(this.startPoint.worldPosition, this.endPoint.worldPosition);

        if (this.isDisappearing) {
            for (let i = visiblePoints - 1; i >= 0; i--) {
                const t = i / (this.resolution - 1);
                const curveOffset = this.curve.evaluate(t);
                const heightOffset = (this.heighCurve.evaluate(t) * distance) / 6.5;

                const point = Vec3.lerp(new Vec3(), startPos, endPos, t)
                    .add(perpendicular.clone().multiplyScalar(curveOffset))
                    .add(new Vec3(0, heightOffset, 0));

                this.linePositions[i] = point;
            }
        } else {
            for (let i = 0; i < visiblePoints; i++) {
                const t = i / (this.resolution - 1);
                const curveOffset = this.curve.evaluate(t);
                const heightOffset = (this.heighCurve.evaluate(t) * distance) / 6.5;

                const point = Vec3.lerp(new Vec3(), startPos, endPos, t)
                    .add(perpendicular.clone().multiplyScalar(curveOffset))
                    .add(new Vec3(0, heightOffset, 0));

                this.linePositions[i] = point;
            }
        }

        this.updateLineRenderer();
    }

    revealLine() {
        const duration = this.revealDuration;

        tween({ progress: 0 })
            .to(
                duration,
                { progress: 1 },
                {
                    onUpdate: (target) => {
                        this.revealProgress = Math.max(0, Math.min(1, target.progress));
                        this.updateCurve();
                    },
                    onComplete: () => {
                        this.revealProgress = 1;
                    },
                }
            )
            .start();
    }

    revealLineNoneCurve() {
        const duration = this.revealDuration;

        tween({ progress: 0 })
            .to(
                duration,
                { progress: 1 },
                {
                    onUpdate: (target) => {
                        this.revealProgress = Math.max(0, Math.min(1, target.progress));
                        this.updateCurveNoneHeightCurve();
                    },
                    onComplete: () => {
                        this.revealProgress = 1;
                    },
                }
            )
            .start();
    }

    updateCurveOverTime() {
        let bridgingTimer = this.timeBridging;
        const distance = Vec3.distance(this.startPoint.worldPosition, this.endPoint.worldPosition) / 2;

        // Wait for initial reveal
        this.scheduleOnce(() => {
            const updateLoop = () => {
                if (!this.isBridging) {
                    this.unbridging();
                    return;
                }

                const randomDir = Math.random() > 0.5 ? 1 : -1;

                this.targetCurve = new CustomAnimationCurve([
                    new CustomKeyframe(
                        0,
                        0,
                        (Math.random() * (this.maxTangentValue - this.minTangentValue) + this.minTangentValue) * distance * randomDir,
                        (Math.random() * (this.maxTangentValue - this.minTangentValue) + this.minTangentValue) * distance * randomDir
                    ),
                    new CustomKeyframe(
                        1,
                        0,
                        Math.random() * (this.maxTangentValue2 - this.minTangentValue2) + this.minTangentValue2,
                        Math.random() * (this.maxTangentValue2 - this.minTangentValue2) + this.minTangentValue2
                    ),
                ]);

                const initialCurve = new CustomAnimationCurve(this.curve.keyFrames);

                tween({ t: 0 })
                    .to(
                        this.transitionTime,
                        { t: 1 },
                        {
                            onUpdate: (target) => {
                                const t = target.t;
                                const keys = this.curve.keyFrames;

                                for (let i = 0; i < keys.length; i++) {
                                    if (this.targetCurve.keyFrames[i]) {
                                        keys[i].inTangent = this.lerp(
                                            initialCurve.keyFrames[i].inTangent,
                                            this.targetCurve.keyFrames[i].inTangent,
                                            t
                                        );
                                        keys[i].outTangent = this.lerp(
                                            initialCurve.keyFrames[i].outTangent,
                                            this.targetCurve.keyFrames[i].outTangent,
                                            t
                                        );
                                    }
                                }
                                this.updateCurve();
                            },
                            onComplete: () => {
                                bridgingTimer -= this.transitionTime;
                                if (bridgingTimer > 0) {
                                    this.scheduleOnce(updateLoop, 0);
                                } else {
                                    this.unbridging();
                                }
                            },
                        }
                    )
                    .start();
            };

            updateLoop();
        }, this.revealDuration);
    }

    updateCurveNoneHeightCurveOverTime() {
        let bridgingTimer = this.timeBridging;
        const distance = Vec3.distance(this.startPoint.worldPosition, this.endPoint.worldPosition) / 2;
        console.log(distance);

        // Wait for initial reveal
        this.scheduleOnce(() => {
            const updateLoop = () => {
                if (!this.isBridging) {
                    this.unbridging();
                    return;
                }

                const randomDir = Math.random() > 0.5 ? 1 : -1;

                this.targetCurve = new CustomAnimationCurve([
                    new CustomKeyframe(
                        0,
                        0,
                        (Math.random() * (this.maxTangentValue - this.minTangentValue) + this.minTangentValue) * distance * randomDir,
                        (Math.random() * (this.maxTangentValue - this.minTangentValue) + this.minTangentValue) * distance * randomDir
                    ),
                    new CustomKeyframe(
                        1,
                        0,
                        Math.random() * (this.maxTangentValue2 - this.minTangentValue2) + this.minTangentValue2,
                        Math.random() * (this.maxTangentValue2 - this.minTangentValue2) + this.minTangentValue2
                    ),
                ]);

                const initialCurve = new CustomAnimationCurve(this.curve.keyFrames);

                tween({ t: 0 })
                    .to(
                        this.transitionTime,
                        { t: 1 },
                        {
                            onUpdate: (target) => {
                                const t = target.t;
                                const keys = this.curve.keyFrames;

                                for (let i = 0; i < keys.length; i++) {
                                    if (this.targetCurve.keyFrames[i]) {
                                        keys[i].inTangent = this.lerp(
                                            initialCurve.keyFrames[i].inTangent,
                                            this.targetCurve.keyFrames[i].inTangent,
                                            t
                                        );
                                        keys[i].outTangent = this.lerp(
                                            initialCurve.keyFrames[i].outTangent,
                                            this.targetCurve.keyFrames[i].outTangent,
                                            t
                                        );
                                    }
                                }
                                this.updateCurveNoneHeightCurve();
                            },
                            onComplete: () => {
                                bridgingTimer -= this.transitionTime;
                                if (bridgingTimer > 0) {
                                    this.scheduleOnce(updateLoop, 0);
                                } else {
                                    this.unbridging();
                                }
                            },
                        }
                    )
                    .start();
            };

            updateLoop();
        }, this.revealDuration);
    }

    updateCurveOverTimeFilling() {
        let bridgingTimer = this.timeBridging;

        // Wait for initial reveal
        this.scheduleOnce(() => {
            const updateLoop = () => {
                if (!this.isBridging) {
                    return;
                }

                const randomDir = Math.random() > 0.5 ? 1 : -1;

                this.targetCurve = new CustomAnimationCurve([
                    new CustomKeyframe(
                        0,
                        0,
                        (Math.random() * (this.maxTangentValue - this.minTangentValue) + this.minTangentValue) * randomDir,
                        (Math.random() * (this.maxTangentValue - this.minTangentValue) + this.minTangentValue) * randomDir
                    ),
                    new CustomKeyframe(
                        1,
                        0,
                        (Math.random() * (this.maxTangentValue2 - this.minTangentValue2) + this.minTangentValue2) * randomDir,
                        (Math.random() * (this.maxTangentValue2 - this.minTangentValue2) + this.minTangentValue2) * randomDir
                    ),
                ]);

                const initialCurve = new CustomAnimationCurve(this.curve.keyFrames);

                tween({ t: 0 })
                    .to(
                        this.transitionTime,
                        { t: 1 },
                        {
                            onUpdate: (target) => {
                                const t = target.t;
                                const keys = this.curve.keyFrames;

                                for (let i = 0; i < keys.length; i++) {
                                    if (this.targetCurve.keyFrames[i]) {
                                        keys[i].inTangent = this.lerp(
                                            initialCurve.keyFrames[i].inTangent,
                                            this.targetCurve.keyFrames[i].inTangent,
                                            t
                                        );
                                        keys[i].outTangent = this.lerp(
                                            initialCurve.keyFrames[i].outTangent,
                                            this.targetCurve.keyFrames[i].outTangent,
                                            t
                                        );
                                    }
                                }
                                this.updateCurveFilling();
                            },
                        }
                    )
                    .start();

                bridgingTimer -= this.transitionTime;
                if (bridgingTimer > 0) {
                    this.scheduleOnce(updateLoop, this.transitionTime);
                }
            };

            updateLoop();
        }, this.revealDuration);
    }

    updateCurveFilling() {
        if (!this.startPoint || !this.endPoint) return;

        const visiblePoints = Math.floor(this.resolution * this.revealProgress);
        this.linePositions = new Array(visiblePoints);

        const startPos = this.startPoint.worldPosition.clone().add(this.offsetStartPoint);
        const endPos = this.endPoint.worldPosition.clone();
        const direction = endPos.clone().subtract(startPos).normalize();

        const perpendicular = new Vec3(-direction.z, 0, direction.x).multiplyScalar(this.curveWidth);

        if (this.isDisappearing) {
            for (let i = visiblePoints - 1; i >= 0; i--) {
                const t = i / (this.resolution - 1);
                const curveOffset = this.curve.evaluate(t);

                const point = Vec3.lerp(new Vec3(), endPos, startPos, t).add(perpendicular.clone().multiplyScalar(curveOffset));

                this.linePositions[i] = point;
            }
        } else {
            for (let i = 0; i < visiblePoints; i++) {
                const t = i / (this.resolution - 1);
                const curveOffset = this.curve.evaluate(t);

                const point = Vec3.lerp(new Vec3(), startPos, endPos, t).add(perpendicular.clone().multiplyScalar(curveOffset));

                this.linePositions[i] = point;
            }
        }

        this.updateLineRenderer();
    }

    unbridging() {
        if (!this.isDisappearing) {
            this.fadeOutLine();
        }
    }

    fadeOutLine() {
        this.isDisappearing = true;

        tween({ progress: 1 })
            .to(
                this.disappearDuration,
                { progress: 0 },
                {
                    onUpdate: (target) => {
                        this.revealProgress = Math.max(0, Math.min(1, target.progress));
                        this.updateCurve();
                    },
                    onComplete: () => {
                        this.linePositions = []; // Fully disappear
                        if (this.graphics) {
                            this.graphics.clear(); // Clear graphics
                        }
                        this.isDisappearing = false;
                        this.isBridging = false;
                        // WoolJumpHandle.instance.CheckLoseGame(); // Replace with appropriate game manager call
                    },
                }
            )
            .start();
    }

    // Helper method for linear interpolation
    private lerp(a: number, b: number, t: number): number {
        return a + (b - a) * t;
    }

    // Update line renderer using Graphics component
    private updateLineRenderer() {
        if (!this.graphics || this.linePositions.length < 2) return;

        this.graphics.clear();
        this.graphics.strokeColor = this.lineColor;
        this.graphics.lineWidth = 10;

        // Convert world positions to local positions
        const localPositions: Vec3[] = [];
        for (const worldPos of this.linePositions) {
            const localPos = new Vec3();
            this.node.getComponent(UITransform).convertToNodeSpaceAR(worldPos, localPos);
            localPositions.push(localPos);
        }

        // Draw the line using Graphics
        if (localPositions.length >= 2) {
            this.graphics.moveTo(localPositions[0].x, localPositions[0].y);

            for (let i = 1; i < localPositions.length; i++) {
                this.graphics.lineTo(localPositions[i].x, localPositions[i].y);
            }

            this.graphics.stroke();
        }
    }
}
