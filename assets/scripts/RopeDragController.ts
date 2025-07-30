import { _decorator, Component, Node, tween, Vec2, v2, Sprite, instantiate } from "cc";
import { MoveWithTouch } from "../curvetexture/MoveWithTouch";
const { ccclass, property } = _decorator;

@ccclass("PointList")
export class PointList {
    @property(Node) posA: Node = null;
    @property(Node) posB: Node = null;
}

@ccclass("RopeDragController")
export class RopeDragController extends Component {
    @property(PointList) pointsList: PointList[] = [];

    @property
    segmentLength: number = 40;

    @property
    damping: number = 0.9; // rope softness

    @property
    gravity: number = 0; // downward force

    @property()
    maxRopePoints: number = 10; // maximum number of points in a rope segment

    @property()
    enableDualEndOscillation: boolean = false;

    @property()
    endOscillationStrength: number = 0.7;

    @property()
    draggedEndForceRatio: number = 0.2;

    @property()
    fixedEndForceRatio: number = 0.8;

    private springStrength: number = 1.8; // spring force: hard rope
    private draggedPoint: Node = null;
    private animationTime: number = 0;

    private ropeSegments: {
        points: Vec2[];
        velocities: Vec2[];
        pointA: Node;
        pointB: Node;
        nodes: Node[];
    }[] = [];

    onLoad() {
        this.init();
        let pointA = this.pointsList[0]?.posA;

        let xB = pointA ? pointA.getPosition().x : 0;

        tween(pointA)
            .repeatForever(
                tween()
                    .to(1, { x: xB - 70 })
                    .to(1, { x: xB + 70 })
            )
            .start();
    }

    init() {
        this.ropeSegments = [];

        for (let obj of this.pointsList) {
            this.createSimulatedRope(obj.posA, obj.posB);
        }
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

        ropeSegmentPoints.push(v2(posA.x, posA.y));
        ropeSegmentVelocities.push(v2(0, 0));
        ropeSegmentNodes.push(pointA);

        for (let k = 1; k < numberOfPoints - 1; k++) {
            let t = k / (numberOfPoints - 1);
            const x = posA.x * (1 - t) + posB.x * t;
            const y = posA.y * (1 - t) + posB.y * t;

            console.log("Creating point:", k, "at", x, y, v2(x, y));

            ropeSegmentPoints.push(v2(x, y));
            ropeSegmentVelocities.push(v2(0, 0));

            let node = this.createPoint(v2(x, y), k + 1, "Rope1");
            ropeSegmentNodes.push(node);
        }
        ropeSegmentPoints.push(v2(posB.x, posB.y));
        ropeSegmentVelocities.push(v2(0, 0));
        ropeSegmentNodes.push(pointB);

        pointA.setSiblingIndex(0);
        pointB.setSiblingIndex(numberOfPoints);

        this.ropeSegments.push({
            points: ropeSegmentPoints,
            velocities: ropeSegmentVelocities,
            pointA: pointA,
            pointB: pointB,
            nodes: ropeSegmentNodes,
        });
        console.log("-----------------init", this.ropeSegments);
    }
    createPoint(position: Vec2, zIndex: number = 0, parentName: string) {
        let point = this.pointsList[0].posA;
        let node = instantiate(point);
        node.setPosition(position.x, position.y, 0);
        node.setParent(this.node.getChildByName(parentName));
        node.setSiblingIndex(zIndex);

        node.getComponent(MoveWithTouch).enabled = false;
        node.getComponent(Sprite).enabled = false;

        return node;
    }

    update(dt: number) {
        this.updateSimulatedPhysics(dt);
        this.setRopeSegments();
    }

    updateSimulatedPhysics(dt: number) {
        if (this.ropeSegments.length === 0) return;

        // Process each rope segment separately
        for (let segment of this.ropeSegments) {
            this.updateSegmentPhysics(segment, dt);
        }
    }
    updateSegmentPhysics(segment: { points: Vec2[]; velocities: Vec2[]; pointA: Node; pointB: Node }, dt: number) {
        // Apply gravity to all points except endpoints
        for (let i = 1; i < segment.points.length - 1; i++) {
            segment.velocities[i].y -= this.gravity * dt;
        }

        // Apply spring forces to maintain rope constraints
        this.applySpringForcesToSegment(segment, dt);

        // Apply asymmetric forces if enabled and this segment is being dragged
        // if (this.useAsymmetricForce && this.isDragging) {
        this.applyAsymmetricForces(segment, dt);
        // }

        // Update positions based on velocities
        for (let i = 1; i < segment.points.length - 1; i++) {
            segment.velocities[i] = segment.velocities[i].multiplyScalar(this.damping);
            segment.points[i] = segment.points[i].add(segment.velocities[i].clone().multiplyScalar(dt));
        }

        // Update endpoints based on pointA and pointB positions
        this.updateSegmentEndpoints(segment);
    }
    applySpringForcesToSegment(segment: { points: Vec2[]; velocities: Vec2[] }, dt: number) {
        for (let i = 1; i < segment.points.length; i++) {
            let current = segment.points[i];
            let previous = segment.points[i - 1];

            let distance = Vec2.distance(current, previous);
            let difference = distance - this.segmentLength;

            if (Math.abs(difference) > 0.1) {
                let direction = current.clone().subtract(previous).normalize();
                let force = direction.clone().multiplyScalar(difference * this.springStrength);

                // Apply force to current point (if not endpoint)
                if (i < segment.points.length - 1 && i > 0) {
                    segment.velocities[i] = segment.velocities[i].clone().subtract(force);
                }

                // // Apply opposite force to previous point (if not endpoint)
                if (i > 1) {
                    segment.velocities[i - 1] = segment.velocities[i - 1].clone().add(force);
                }
            }
        }
    }
    applyAsymmetricForces(segment: { points: Vec2[]; velocities: Vec2[]; pointA: Node; pointB: Node }, dt: number) {
        if (!this.draggedPoint || segment.points.length < 3) return;

        let isDraggingPointA = this.draggedPoint === segment.pointA;
        let isDraggingPointB = this.draggedPoint === segment.pointB;

        if (!isDraggingPointA && !isDraggingPointB) return;

        for (let i = 1; i < segment.points.length - 1; i++) {
            let normalizedPosition = i / (segment.points.length - 1); // 0 to 1
            let forceMultiplier = 1.0;

            if (this.enableDualEndOscillation) {
                let distanceFromCenter = Math.abs(normalizedPosition - 0.5) * 2; // 0 to 1
                forceMultiplier = 1.0 + this.endOscillationStrength * (1 - distanceFromCenter);

                let oscillationForce = Math.sin(this.animationTime * 8) * this.endOscillationStrength * 20;
                if (normalizedPosition < 0.3) {
                    segment.velocities[i].y += (oscillationForce * (0.3 - normalizedPosition)) / 0.3;
                } else if (normalizedPosition > 0.7) {
                    segment.velocities[i].y += (oscillationForce * (normalizedPosition - 0.7)) / 0.3;
                }
            } else {
                if (isDraggingPointA) {
                    forceMultiplier =
                        this.draggedEndForceRatio + (this.fixedEndForceRatio - this.draggedEndForceRatio) * normalizedPosition;
                } else if (isDraggingPointB) {
                    forceMultiplier = this.fixedEndForceRatio + (this.draggedEndForceRatio - this.fixedEndForceRatio) * normalizedPosition;
                }
            }

            segment.velocities[i] = segment.velocities[i].multiplyScalar(forceMultiplier);

            // Apply pull forces
            if (!this.enableDualEndOscillation) {
                if (isDraggingPointA) {
                    let pullDirection = segment.points[segment.points.length - 1].subtract(segment.points[i]).normalize();
                    let pullForce = pullDirection.multiplyScalar(this.springStrength * 0.3 * normalizedPosition);
                    segment.velocities[i] = segment.velocities[i].add(pullForce.multiplyScalar(dt));
                } else if (isDraggingPointB) {
                    let pullDirection = segment.points[0].subtract(segment.points[i]).normalize();
                    let pullForce = pullDirection.multiplyScalar(this.springStrength * 0.3 * (1 - normalizedPosition));
                    segment.velocities[i] = segment.velocities[i].add(pullForce.multiplyScalar(dt));
                }
            } else {
                let waveFromA = Math.sin(this.animationTime * 6 + normalizedPosition * Math.PI) * this.endOscillationStrength;
                let waveFromB = Math.sin(this.animationTime * 6 + (1 - normalizedPosition) * Math.PI) * this.endOscillationStrength;

                let combinedWave = (waveFromA + waveFromB) * 15;
                segment.velocities[i].y += combinedWave * dt;
            }
        }
    }

    updateSegmentEndpoints(segment: { points: Vec2[]; velocities: Vec2[]; pointA: Node; pointB: Node }) {
        if (segment.points.length === 0) return;

        // Update first point (pointA)
        if (segment.pointA && segment.points.length > 0) {
            let targetPos = segment.pointA.getPosition();
            segment.points[0] = v2(targetPos.x, targetPos.y);
            segment.velocities[0] = v2(0, 0);
        }

        // Update last point (pointB)
        if (segment.pointB && segment.points.length > 1) {
            let targetPos = segment.pointB.getPosition();
            segment.points[segment.points.length - 1] = v2(targetPos.x, targetPos.y);
            segment.velocities[segment.velocities.length - 1] = v2(0, 0);
        }
    }

    setRopeSegments() {
        for (let segment of this.ropeSegments) {
            for (let i = 0; i < segment.nodes.length; i++) {
                let node = segment.nodes[i];
                let pos = segment.points[i];
                node.setPosition(pos.x, pos.y, 0);
            }
        }
    }
}
