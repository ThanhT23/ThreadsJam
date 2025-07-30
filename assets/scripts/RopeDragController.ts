import {
    _decorator,
    Component,
    Node,
    Vec3,
    EventTouch,
    Graphics,
    Color,
    tween,
    Vec2,
    v2,
    UITransform,
    UIOpacity,
    Sprite,
    instantiate,
    v3,
} from "cc";
import { CurveTexture } from "../curvetexture/CurveTexture";
import { MoveWithTouch } from "../curvetexture/MoveWithTouch";
const { ccclass, property } = _decorator;

@ccclass("PointList")
export class PointList {
    @property(Node) posA: Node = null;
    @property(Node) posB: Node = null;
}

@ccclass("RopeDragController")
export class RopeDragController extends Component {
    @property([Node])
    points: Node[] = []; // head → footer

    @property(PointList) pointsList: PointList[] = [];

    @property
    segmentLength: number = 40;

    @property
    damping: number = 0.9; // rope softness

    @property
    gravity: number = 0; // downward force

    @property({
        tooltip: "Số điểm rope tối đa. Giá trị nhỏ = rope ngắn hơn",
    })
    maxRopePoints: number = 10;

    private velocities: Vec3[] = [];
    private dragging = false;
    private footerOriginalPos: Vec3 = new Vec3();

    private springStrength: number = 1.3; // spring force: hard rope

    private ropeSegments: {
        points: Vec2[];
        velocities: Vec2[];
        pointA: Node;
        pointB: Node;
        nodes: Node[];
    }[] = [];

    onLoad() {
        // Initialize velocity for each point
        // for (let i = 0; i < this.points.length; i++) {
        //     this.velocities.push(new Vec3());
        // }

        // // Save footer initial position
        // this.footerOriginalPos = this.points[this.points.length - 1].position.clone();

        this.init();

        // Enable head drag
        // const head = this.points[0];
        // head.on(Node.EventType.TOUCH_START, this.startDrag, this);
        // head.on(Node.EventType.TOUCH_MOVE, this.dragHead, this);
        // head.on(Node.EventType.TOUCH_END, this.endDrag, this);
        // head.on(Node.EventType.TOUCH_CANCEL, this.endDrag, this);
    }

    start() {
        // Tween footer left and right forever
        // const footer = this.points[this.points.length - 1];
        // const leftPos = this.footerOriginalPos.clone().add(new Vec3(-50, 0, 0));
        // const rightPos = this.footerOriginalPos.clone().add(new Vec3(50, 0, 0));
        // tween(footer)
        //     .repeatForever(tween().to(1, { position: leftPos }).to(1, { position: rightPos }))
        //     .start();
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

        // const wPosA = pointA.getWorldPosition();
        // const wPosB = pointB.getWorldPosition();

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

        // Add this rope segment to the collection
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
        // let node = new Node("Point");
        let point = this.pointsList[0].posA;
        let node = instantiate(point); // Reuse the first point as a template
        node.setPosition(position.x, position.y, 0);
        node.setParent(this.node.getChildByName(parentName));
        node.setSiblingIndex(zIndex);

        node.getComponent(MoveWithTouch).enabled = false;
        node.getComponent(Sprite).enabled = false;
        // node.addComponent(UITransform);
        // node.addComponent(UIOpacity);
        // node.addComponent(Sprite);

        return node;
    }

    startDrag() {
        this.dragging = true;
    }

    dragHead(event: EventTouch) {
        const delta = event.getUIDelta();
        const head = this.points[0];
        head.setWorldPosition(head.worldPosition.x + delta.x, head.worldPosition.y + delta.y, head.worldPosition.z);
    }

    endDrag() {
        this.dragging = false;
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
        //     this.applyAsymmetricForces(segment, dt);
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
