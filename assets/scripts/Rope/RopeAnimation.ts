import { _decorator, Component, game, instantiate, Node, Sprite, tween, v2, v3, Vec2, Vec3 } from "cc";
import { PointList } from "./RopeDragController";

const { ccclass, property } = _decorator;

@ccclass("RopeAnimation")
export class RopeAnimation extends Component {
    @property(PointList) pointsList: PointList[] = [];
    @property(Node) newPointPrefab: Node = null;

    private segmentLength = 40;
    private maxRopePoints = 4;
    private ropeSegments: {
        points: Vec2[];
        velocities: Vec2[];
        pointA: Node;
        pointB: Node;
        nodes: Node[];
        vector: Vec2;
        animationTime: number[];
        basePositions: Vec2[];
        animationDirection: number[];
    }[] = [];

    private maxDistance = 70;
    private animationCycleDuration = 0.3;

    protected onLoad(): void {
        this.init();
        game.on("moveWithTouch", this.updateBeweenPoints, this);
    }
    init() {
        // Create ropes from pointsList
        for (let obj of this.pointsList) {
            this.createSimulatedRope(obj.posA, obj.posB);
        }

        // Create additional random ropes
        // for (let i = 0; i < this.extraRopesCount; i++) {
        //     this.createNewRope();
        // }
    }

    createSimulatedRope(pointA: Node, pointB: Node) {
        const posA = pointA.getPosition();
        const posB = pointB.getPosition();
        const distance = Vec2.distance(posA, posB);

        const calculatedPoints = Math.ceil(distance / this.segmentLength) || this.maxRopePoints;
        console.log("Calculated points:", distance, this.segmentLength, calculatedPoints);
        const numberOfPoints = Math.min(calculatedPoints, this.maxRopePoints);

        let ropeSegmentPoints: Vec2[] = [];
        let ropeSegmentVelocities: Vec2[] = [];
        let ropeSegmentNodes: Node[] = [];
        let animationTime: number[] = [];
        let basePositions: Vec2[] = [];
        let animationDirection: number[] = [];

        ropeSegmentPoints.push(v2(posA.x, posA.y));
        ropeSegmentVelocities.push(v2(0, 0));
        ropeSegmentNodes.push(pointA);
        animationTime.push(0);
        basePositions.push(v2(posA.x, posA.y));
        animationDirection.push(1);

        const parentNode = pointA.parent;
        const vector = v2(posB.x - posA.x, posB.y - posA.y);
        const angle = Math.atan2(vector.y, vector.x);
        for (let k = 1; k < numberOfPoints - 1; k++) {
            let t = k / (numberOfPoints - 1);
            if (k % 2 === 1) {
                t = (k / (numberOfPoints - 1)) * 0.5;
            }
            const x = posA.x * (1 - t) + posB.x * t;
            const y = posA.y * (1 - t) + posB.y * t;

            ropeSegmentPoints.push(v2(x, y));
            ropeSegmentVelocities.push(v2(0, 0));
            // animationTime.push(Math.random() * this.animationCycleDuration); // Random start time
            animationTime.push(0);
            basePositions.push(v2(x, y));
            animationDirection.push(1);

            let node = this.createPoint(x, y, parentNode, k + 1, Math.PI / 2 - angle);
            ropeSegmentNodes.push(node);
        }
        ropeSegmentPoints.push(v2(posB.x, posB.y));
        ropeSegmentVelocities.push(v2(0, 0));
        ropeSegmentNodes.push(pointB);
        animationTime.push(0);
        basePositions.push(v2(posB.x, posB.y));
        animationDirection.push(1);

        pointA.setSiblingIndex(0);
        pointB.setSiblingIndex(numberOfPoints);

        this.ropeSegments.push({
            points: ropeSegmentPoints,
            velocities: ropeSegmentVelocities,
            pointA: pointA,
            pointB: pointB,
            nodes: ropeSegmentNodes,
            vector: v2(posA.x - posB.x, posA.y - posB.y),
            animationTime: animationTime,
            basePositions: basePositions,
            animationDirection: animationDirection,
        });
        console.log("-----------------init", this.ropeSegments);
    }

    createPoint(x: number, y: number, parent: Node, index: number, angle: number): Node {
        let newPoint = instantiate(this.newPointPrefab);
        newPoint.setPosition(x, y, 0);
        newPoint.name = `gizmo_${index}`;
        newPoint.setSiblingIndex(index);
        newPoint.setParent(parent);
        newPoint.active = true;
        newPoint.getComponent(Sprite).enabled = false;

        (newPoint as any)._animationAngle = angle;
        (newPoint as any)._pointIndex = index;

        return newPoint;
    }

    updateBeweenPoints() {
        for (let segment of this.ropeSegments) {
            const posA = segment.pointA.getPosition();
            const posB = segment.pointB.getPosition();

            for (let i = 1; i < segment.points.length - 1; i++) {
                let t = i / (segment.points.length - 1);
                if (i % 2 === 1) {
                    t = (i / (segment.points.length - 1)) * 0.5;
                }
                const x = posA.x * (1 - t) + posB.x * t;
                const y = posA.y * (1 - t) + posB.y * t;
                segment.basePositions[i] = v2(x, y);
            }

            segment.basePositions[0] = v2(posA.x, posA.y);
            segment.basePositions[segment.basePositions.length - 1] = v2(posB.x, posB.y);

            segment.vector = v2(posB.x - posA.x, posB.y - posA.y);
        }
    }

    private sineInOut(t: number): number {
        return -(Math.cos(Math.PI * t) - 1) / 2;
    }

    protected update(dt: number): void {
        for (let segment of this.ropeSegments) {
            let angle = Math.atan2(segment.vector.y, segment.vector.x);
            let adjustedAngle = Math.PI / 2 - angle;

            for (let i = 0; i < segment.nodes.length; i++) {
                if (i === 0 || i === segment.nodes.length - 1) continue;

                let node = segment.nodes[i];
                let basePos = segment.basePositions[i];

                segment.animationTime[i] += dt;

                let distance = this.maxDistance;
                let pointIndex = (node as any)._pointIndex;
                if (pointIndex % 2 === 0) {
                    distance = distance / 3;
                }

                let timeInCycle = segment.animationTime[i] % this.animationCycleDuration;
                let normalizedTime = timeInCycle / this.animationCycleDuration;

                let sineValue = Math.sin(2 * Math.PI * normalizedTime);

                let absValue = Math.abs(sineValue);
                let easedAbs = this.sineInOut(absValue);
                let smoothValue = sineValue >= 0 ? easedAbs : -easedAbs;

                let offsetX = Math.cos(adjustedAngle) * distance * smoothValue;
                let offsetY = -Math.sin(adjustedAngle) * distance * smoothValue;

                node.setPosition(basePos.x + offsetX, basePos.y + offsetY, 0);

                segment.points[i] = v2(node.position.x, node.position.y);
            }
        }
    }

    createNewRope() {
        const winSize = game.canvas ? { width: game.canvas.width, height: game.canvas.height } : { width: 960, height: 640 };
        let randomPos1 = v2(Math.random() * 800 - winSize.width / 2, Math.random() * 500 - winSize.height / 2 + 100);
        let toPos2 = v2(Math.random() * 800 - winSize.width / 2, Math.random() * 700 + winSize.height / 3 - 100);

        let rope = instantiate(this.newPointPrefab.parent);
        rope.removeAllChildren();
        rope.setParent(this.node);
        rope.setPosition(0, 0, 0);
        const parentNode = rope;

        // Create point A
        let pointA = instantiate(this.newPointPrefab);
        pointA.setPosition(randomPos1.x, randomPos1.y, 0);
        pointA.name = `gizmo_0`;
        pointA.setParent(parentNode);
        pointA.active = true;

        // Create point B
        let pointB = instantiate(this.newPointPrefab);
        pointB.setPosition(randomPos1.x, randomPos1.y, 0);
        pointB.name = `gizmo_end`;
        pointB.setParent(parentNode);
        pointB.active = true;

        this.pointsList.push({ posA: pointA, posB: pointB });

        this.createSimulatedRope(pointA, pointB);

        var rndInt = (min: number = undefined, max: number = undefined): number => {
            return Math.floor(min + (max - min) * Math.random());
        };
        const listCoord: { x: number; y: number }[] = [];
        do {
            let lastCoord = listCoord[listCoord.length - 1] || { x: 0, y: 0 };
            let x = lastCoord.x <= 10 ? lastCoord.x + 1 : -10;
            let y = x == -10 ? lastCoord.y + 1 : lastCoord.y;
            if (listCoord.findIndex((obj) => obj.x === x && obj.y === y) === -1) {
                listCoord.push({ x, y });
            }
        } while (listCoord.length < 25);

        let listPos: Vec3[] = [];
        let lastPos = toPos2.clone();
        for (let i = 0; i < 30; i++) {
            let r = Math.random() < 0.5 ? 1 : -1;
            let rPos = lastPos.clone().add(v2(r * Math.random() * rndInt(-200, 200), r * Math.random() * rndInt(-200, 200)));
            listPos.push(v3(rPos.x, rPos.y, 0));
            lastPos = rPos;
        }
        tween(pointA)
            .delay(0.1)
            .to(
                0.2,
                { position: v3(toPos2.x, toPos2.y, 0) },
                {
                    onUpdate: (target) => {
                        this.updateBeweenPoints();
                    },
                }
            )
            .start();

        for (let i = 0; i < listCoord.length; i++) {
            // let pos = listPos[i];
            let coord = listCoord[i];
            let pos = v3(toPos2.x + coord.x * 20, toPos2.y + coord.y * 20, 0);
            tween(pointA)
                .delay(0.1 * i + 0.5)
                .to(
                    0.1,
                    { position: pos },
                    {
                        onUpdate: (target) => {
                            this.updateBeweenPoints();
                        },
                    }
                )
                .call(() => {
                    if (i === listCoord.length - 1) {
                        let index = this.pointsList.findIndex((obj) => obj.posA === pointA && obj.posB === pointB);
                        if (index === -1) return;
                        this.removeRope(index);
                        for (let i = rope.children.length - 1; i >= 0; i--) {
                            if (i === 0 || i === rope.children.length - 1) continue;
                            let node = rope.children[i];
                            node.destroy();
                        }

                        tween(pointB)
                            .to(
                                0.2,
                                { position: v3(pos.x, pos.y, 0) },
                                {
                                    onUpdate: (target) => {
                                        this.updateBeweenPoints();
                                    },
                                }
                            )
                            .call(() => {
                                this.scheduleOnce(() => {
                                    this.removeRope(index);
                                    rope.destroy();
                                });
                            })
                            .start();
                    }
                })
                .start();
        }
    }
    rndInt(min: number = undefined, max: number = undefined): number {
        return Math.floor(min + (max - min) * Math.random());
    }
    removeRope(index: number) {
        if (index < 0 || index >= this.pointsList.length) return;
        this.pointsList.splice(index, 1);
        this.ropeSegments.splice(index, 1);
    }
}
