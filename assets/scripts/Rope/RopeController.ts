import {
    _decorator,
    Node,
    Component,
    Graphics,
    SpriteFrame,
    Vec2,
    tween,
    Color,
    v2,
    instantiate,
    Sprite,
    director,
    Vec3,
    v3,
    EventTouch,
    UITransform,
} from "cc";
import Bezier from "./bezier";
import { PointList } from "./RopeDragController";

const { ccclass, property } = _decorator;

export class RoleLine {
    public ropePointNodes: Node[] = [];
    constructor() {
        this.ropePointNodes = [];
    }
}

@ccclass
export default class RopeController extends Component {
    @property(Graphics) graphics: Graphics = null;
    @property(PointList) pointList: PointList[] = [];
    @property() moveSpeed: number = 2.0;
    @property(Node)
    pointPrefab: Node = null;
    @property(Node)
    renderRopePrefab: Node = null;
    @property(Boolean)
    startWithPhysics: boolean = false;
    @property(SpriteFrame) ropeSprite: SpriteFrame = null;
    @property({
        tooltip: "Sử dụng sprite thay vì graphics để vẽ rope",
    })
    useSpriteRender: boolean = false;
    @property({
        tooltip: "Kích thước mỗi segment sprite",
    })
    spriteSegmentSize: number = 20;

    @property({
        tooltip: "Số điểm rope tối đa. Giá trị nhỏ = rope ngắn hơn",
    })
    maxRopePoints: number = 10;

    @property({
        tooltip: "Bật asymmetric force - đầu kéo ít bị ảnh hưởng, đầu còn lại bị ảnh hưởng mạnh",
    })
    useAsymmetricForce: boolean = false;

    @property({
        tooltip: "Tỷ lệ force cho đầu đang kéo (0-1, giá trị nhỏ = ít bị ảnh hưởng)",
    })
    draggedEndForceRatio: number = 0.2;

    @property({
        tooltip: "Tỷ lệ force cho đầu còn lại (0-1, giá trị lớn = bị ảnh hưởng mạnh)",
    })
    fixedEndForceRatio: number = 0.8;

    @property({
        tooltip: "Độ nhạy của instant forces khi drag (0-1, giá trị lớn = phản ứng mạnh hơn)",
    })
    instantForceStrength: number = 0.5;

    @property(Boolean) downImpact: boolean = false; // Bật tắt lực kéo xuống

    @property({
        tooltip: "Bật dao động mạnh ở cả 2 đầu rope",
    })
    enableDualEndOscillation: boolean = false;

    @property({
        tooltip: "Cường độ dao động ở endpoints (0-1)",
    })
    endOscillationStrength: number = 0.7;

    // Animation properties for continuous movement
    private animationTime: number = 0;
    private animationDuration: number = 3.0; // 3 seconds per cycle
    private waveAmplitude: number = 30; // Độ cao của sóng
    private waveFrequency: number = 2; // Tần số sóng
    private enableContinuousAnimation: boolean = true;

    private lines: RoleLine[] = [];
    private renderRope: Node[] = [];

    // Sprite rope rendering
    private spritePool: Node[] = []; // Pool để tái sử dụng sprites
    private activeSpriteCount: number = 0; // Số lượng sprites đang được sử dụng

    // Simulated physics properties (without real physics engine)
    private isSimulatedPhysicsEnabled: boolean = false;
    private isDragging: boolean = false;
    private draggedPoint: Node = null;
    private currentDraggedSegmentIndex: number = -1; // Track which segment is being dragged

    // Rope simulation data -multiple ropes
    private ropeSegments: {
        points: Vec2[];
        velocities: Vec2[];
        pointA: Node;
        pointB: Node;
    }[] = [];
    private gravity: number = 0; // Simulated gravity
    private damping: number = 0.8; // Air resistance
    private springStrength: number = 1.3; // spring force: hard rope
    private segmentLength: number = 15; // Desired distance between points

    onLoad() {
        // Set segment length from editor property
        // this.segmentLength = this.segmentLengthEditor;

        // Set initial mode
        this.isSimulatedPhysicsEnabled = this.startWithPhysics;
        this.enableContinuousAnimation = !this.startWithPhysics;

        // Initialize rope based on mode
        if (this.isSimulatedPhysicsEnabled) {
            this.initializeSimulatedRope();
        }

        // Enable touch events for dragging endpoints
        this.enableTouchEvents();

        // Pre-populate sprite pool if using sprite render
        if (this.useSpriteRender) {
            this.initializeSpritePool();
        }

        let pointB = this.pointList[0]?.posB;

        let xB = pointB ? pointB.getPosition().x : 0;

        // Demo dual end oscillation
        this.createDualOscillatingRope();

        tween(pointB)
            .repeatForever(
                tween()
                    .to(1, { x: xB - 30 })
                    .to(1, { x: xB + 30 })
            )
            .start();
    }

    onDestroy() {
        this.clearAllSprites();
    }

    update(dt: number) {
        if (this.enableContinuousAnimation && !this.isSimulatedPhysicsEnabled) {
            this.updateContinuousRopeAnimation(dt);
        } else if (this.isSimulatedPhysicsEnabled) {
            this.updateSimulatedPhysics(dt);
            if (this.useSpriteRender) {
                this.graphics.clear();
                this.drawSpriteRope();
            } else {
                this.drawSimulatedRope();
            }
        }
    }

    updateContinuousRopeAnimation(dt: number) {
        this.animationTime += dt;

        // Reset animation cycle
        if (this.animationTime >= this.animationDuration) {
            this.animationTime = 0;
        }

        this.drawAnimatedRope();
    }

    drawAnimatedRope() {
        if (!this.graphics || this.pointList.length === 0) return;

        this.graphics.clear();
        this.graphics.lineWidth = 4;
        this.graphics.strokeColor = Color.YELLOW;

        for (let obj of this.pointList) {
            if (!obj.posA || !obj.posB) continue;

            const startPos = obj.posA.getPosition();
            const endPos = obj.posB.getPosition();

            const progress = this.animationTime / this.animationDuration;
            const waveOffset1 = Math.sin(progress * Math.PI * this.waveFrequency) * this.waveAmplitude;
            const waveOffset2 = Math.cos(progress * Math.PI * this.waveFrequency + Math.PI / 3) * this.waveAmplitude * 0.7;

            const midX = (startPos.x + endPos.x) / 2;
            const midY = (startPos.y + endPos.y) / 2;

            const controlPoint1 = v2(midX + waveOffset1, midY + waveOffset2 + 20);

            const controlPoint2 = v2(midX - waveOffset1 * 0.5, midY - waveOffset2 + 30);

            const bezierPoints = [startPos, controlPoint1, controlPoint2, endPos];
            const bezier = new Bezier(bezierPoints, 1.0);
            const curvePoints = bezier.getPoints(30); // 30 points for per segment

            if (curvePoints.length > 1) {
                this.graphics.moveTo(curvePoints[0].x, curvePoints[0].y);
                for (let i = 1; i < curvePoints.length; i++) {
                    this.graphics.lineTo(curvePoints[i].x, curvePoints[i].y);
                }
            }
        }
        for (var t = 0; t < this.lines.length; t++) {
            var e = this.lines[t];
            var o = [];
            var r = this.renderRope[t];
            if (!r) {
                r = instantiate(this.renderRopePrefab);
                r.parent = this.node;
                r.setSiblingIndex(-1);
                r.active = true;
                r.x = 0;
                r.y = 0;
                this.renderRope[t] = r;
            }
            for (var i = 0; i < e.ropePointNodes.length; i++) {
                var n = e.ropePointNodes[i];
                o.push(n.getPosition());
            }
        }

        this.graphics.stroke();
    }

    // New simulated physics methods for multiple ropes
    initializeSimulatedRope() {
        this.ropeSegments = [];

        for (let obj of this.pointList) {
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

        for (let k = 0; k < numberOfPoints; k++) {
            let t = k / (numberOfPoints - 1);
            const x = posA.x * (1 - t) + posB.x * t;
            const y = posA.y * (1 - t) + posB.y * t;

            ropeSegmentPoints.push(v2(x, y));
            ropeSegmentVelocities.push(v2(0, 0));
        }

        // Add this rope segment to the collection
        this.ropeSegments.push({
            points: ropeSegmentPoints,
            velocities: ropeSegmentVelocities,
            pointA: pointA,
            pointB: pointB,
        });
    }

    // createSimulatedRopeWithFixedPoints(pointA: Node, pointB: Node, numberOfPoints: number) {
    //     const posA = pointA.getPosition();
    //     const posB = pointB.getPosition();

    //     // Create rope points array for this rope segment
    //     let ropeSegmentPoints: Vec2[] = [];
    //     let ropeSegmentVelocities: Vec2[] = [];

    //     for (let k = 0; k < numberOfPoints; k++) {
    //         let t = k / (numberOfPoints - 1);
    //         const x = posA.x * (1 - t) + posB.x * t;
    //         const y = posA.y * (1 - t) + posB.y * t;

    //         ropeSegmentPoints.push(v2(x, y));
    //         ropeSegmentVelocities.push(v2(0, 0));
    //     }

    //     this.ropePoints.push(...ropeSegmentPoints);
    //     this.ropeVelocities.push(...ropeSegmentVelocities);
    // }

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
        if (this.useAsymmetricForce && this.isDragging) {
            this.applyAsymmetricForces(segment, dt);
        }

        // Update positions based on velocities
        for (let i = 1; i < segment.points.length - 1; i++) {
            segment.velocities[i] = segment.velocities[i].multiplyScalar(this.damping);
            segment.points[i] = segment.points[i].add(segment.velocities[i].multiplyScalar(dt));
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
                let direction = current.subtract(previous).normalize();
                let force = direction.multiplyScalar(difference * this.springStrength);

                // Apply force to current point (if not endpoint)
                if (i < segment.points.length - 1 && i > 0) {
                    segment.velocities[i] = segment.velocities[i].subtract(force);
                }

                // Apply opposite force to previous point (if not endpoint)
                if (i > 1) {
                    segment.velocities[i - 1] = segment.velocities[i - 1].add(force);
                }
            }
        }
    }

    applyAsymmetricForces(segment: { points: Vec2[]; velocities: Vec2[]; pointA: Node; pointB: Node }, dt: number) {
        if (!this.draggedPoint || segment.points.length < 3) return;

        // Determine which end is being dragged
        let isDraggingPointA = this.draggedPoint === segment.pointA;
        let isDraggingPointB = this.draggedPoint === segment.pointB;

        if (!isDraggingPointA && !isDraggingPointB) return;

        // Create asymmetric force distribution with dual end oscillation
        for (let i = 1; i < segment.points.length - 1; i++) {
            let normalizedPosition = i / (segment.points.length - 1); // 0 to 1
            let forceMultiplier = 1.0;

            if (this.enableDualEndOscillation) {
                // Both ends oscillate strongly - create wave-like effect
                let distanceFromCenter = Math.abs(normalizedPosition - 0.5) * 2; // 0 to 1
                forceMultiplier = 1.0 + this.endOscillationStrength * (1 - distanceFromCenter);

                // Add oscillating force at both ends
                let oscillationForce = Math.sin(this.animationTime * 8) * this.endOscillationStrength * 20;
                if (normalizedPosition < 0.3) {
                    // Near pointA
                    segment.velocities[i].y += (oscillationForce * (0.3 - normalizedPosition)) / 0.3;
                } else if (normalizedPosition > 0.7) {
                    // Near pointB
                    segment.velocities[i].y += (oscillationForce * (normalizedPosition - 0.7)) / 0.3;
                }
            } else {
                // Original asymmetric behavior
                if (isDraggingPointA) {
                    forceMultiplier =
                        this.draggedEndForceRatio + (this.fixedEndForceRatio - this.draggedEndForceRatio) * normalizedPosition;
                } else if (isDraggingPointB) {
                    forceMultiplier = this.fixedEndForceRatio + (this.draggedEndForceRatio - this.fixedEndForceRatio) * normalizedPosition;
                }
            }

            // Apply velocity dampening based on force multiplier
            segment.velocities[i] = segment.velocities[i].multiplyScalar(forceMultiplier);

            // Apply pull forces
            if (!this.enableDualEndOscillation) {
                // Original pull logic
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
                // Dual oscillation - create wave propagation from both ends
                let waveFromA = Math.sin(this.animationTime * 6 + normalizedPosition * Math.PI) * this.endOscillationStrength;
                let waveFromB = Math.sin(this.animationTime * 6 + (1 - normalizedPosition) * Math.PI) * this.endOscillationStrength;

                let combinedWave = (waveFromA + waveFromB) * 15;
                segment.velocities[i].y += combinedWave * dt;
            }
        }
    }

    // Apply instant asymmetric forces during drag movement
    applyInstantAsymmetricForces(draggedPoint: Node, dragDelta: Vec2) {
        // Find the segment that contains the dragged point
        for (let segment of this.ropeSegments) {
            if (segment.pointA === draggedPoint || segment.pointB === draggedPoint) {
                this.applyInstantForceToSegment(segment, draggedPoint, dragDelta);
                break;
            }
        }
    }

    applyInstantForceToSegment(
        segment: { points: Vec2[]; velocities: Vec2[]; pointA: Node; pointB: Node },
        draggedPoint: Node,
        dragDelta: Vec2
    ) {
        if (segment.points.length < 3) return;

        let isDraggingPointA = draggedPoint === segment.pointA;
        let isDraggingPointB = draggedPoint === segment.pointB;

        if (!isDraggingPointA && !isDraggingPointB) return;

        // Apply immediate drag influence to rope points
        for (let i = 1; i < segment.points.length - 1; i++) {
            let normalizedPosition = i / (segment.points.length - 1);
            let influenceStrength = 0;

            if (this.enableDualEndOscillation) {
                // Both ends have strong influence - create bidirectional wave
                let distanceFromEnds = Math.min(normalizedPosition, 1 - normalizedPosition) * 2; // 0 to 1
                influenceStrength = this.fixedEndForceRatio * (1 - distanceFromEnds) + this.draggedEndForceRatio * distanceFromEnds;

                // Add extra oscillation when dragging
                let extraOscillation = this.endOscillationStrength * Math.sin(normalizedPosition * Math.PI * 2);
                influenceStrength += extraOscillation * 0.3;
            } else {
                // Original asymmetric logic
                if (isDraggingPointA) {
                    influenceStrength = this.fixedEndForceRatio * (1 - normalizedPosition) + this.draggedEndForceRatio * normalizedPosition;
                } else if (isDraggingPointB) {
                    influenceStrength = this.draggedEndForceRatio * (1 - normalizedPosition) + this.fixedEndForceRatio * normalizedPosition;
                }
            }

            // Apply drag delta proportionally
            let dragInfluence = dragDelta.multiplyScalar(influenceStrength * this.instantForceStrength);
            segment.velocities[i] = segment.velocities[i].add(dragInfluence.multiplyScalar(60)); // Convert to velocity (assuming 60fps)
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

    drawSimulatedRope() {
        if (!this.graphics || this.ropeSegments.length === 0) return;

        this.graphics.clear();
        this.graphics.lineWidth = 4;
        this.graphics.strokeColor = Color.YELLOW;

        // Draw each rope segment separately
        for (let segment of this.ropeSegments) {
            if (segment.points.length > 1) {
                this.graphics.moveTo(segment.points[0].x, segment.points[0].y);

                for (let i = 1; i < segment.points.length; i++) {
                    // Use smooth curves instead of straight lines
                    if (i < segment.points.length - 1) {
                        let current = segment.points[i];
                        let next = segment.points[i + 1];
                        let controlPoint = v2((current.x + next.x) / 2, (current.y + next.y) / 2);
                        this.graphics.quadraticCurveTo(current.x, current.y, controlPoint.x, controlPoint.y);
                    } else {
                        this.graphics.lineTo(segment.points[i].x, segment.points[i].y);
                    }
                }
            }
        }

        this.graphics.stroke();
    }

    // New method: Draw rope using sprite tiles with object pooling for multiple segments
    drawSpriteRope() {
        if (!this.ropeSprite || this.ropeSegments.length === 0) return;

        // Reset active sprite count
        this.activeSpriteCount = 0;

        // Create sprite segments for each rope segment
        for (let segment of this.ropeSegments) {
            for (let i = 0; i < segment.points.length - 1; i++) {
                this.createSpriteBetweenPoints(segment.points[i], segment.points[i + 1]);
            }
        }

        // Hide unused sprites
        this.hideUnusedSprites();
    }

    // Get sprite from pool or create new one
    getSpriteFromPool(): Node {
        if (this.activeSpriteCount < this.spritePool.length) {
            // Reuse existing sprite from pool
            let sprite = this.spritePool[this.activeSpriteCount];
            sprite.active = true;
            return sprite;
        } else {
            // Create new sprite and add to pool
            // let ropeRender = instantiate(this.renderRopePrefab);
            let spriteNode = new Node();
            spriteNode.parent = this.node;

            // Add sprite component
            let spriteComponent = spriteNode.addComponent(Sprite);
            spriteComponent.spriteFrame = this.ropeSprite;

            // Set z-index to render behind other elements
            spriteNode.setSiblingIndex(-1);

            // Add to pool
            this.spritePool.push(spriteNode);

            return spriteNode;
        }
    }

    // Hide sprites that are not being used
    hideUnusedSprites() {
        for (let i = this.activeSpriteCount; i < this.spritePool.length; i++) {
            this.spritePool[i].active = false;
        }
    }

    clearRopeSprites() {
        // Just hide all sprites instead of destroying them
        for (let sprite of this.spritePool) {
            if (sprite && sprite.isValid) {
                sprite.active = false;
            }
        }
        this.activeSpriteCount = 0;
    }

    // Complete cleanup - only called on destroy
    clearAllSprites() {
        for (let sprite of this.spritePool) {
            if (sprite && sprite.isValid) {
                sprite.destroy();
            }
        }
        this.spritePool = [];
        this.activeSpriteCount = 0;
    }

    createSpriteBetweenPoints(pointA: Vec2, pointB: Vec2) {
        const distance = Vec2.distance(pointA, pointB);
        const numberOfSprites = Math.ceil(distance / this.spriteSegmentSize);

        for (let i = 0; i < numberOfSprites; i++) {
            let t = i / numberOfSprites;
            let spritePos = v2(pointA.x * (1 - t) + pointB.x * t, pointA.y * (1 - t) + pointB.y * t);

            //
            // Get sprite from pool instead of creating new
            let spriteNode = this.getSpriteFromPool();

            // Set position
            spriteNode.setPosition(v3(spritePos.x, spritePos.y, 0));

            // Calculate rotation to align with rope direction
            let direction = pointB.subtract(pointA);
            let angle = (Math.atan2(direction.y, direction.x) * 180) / Math.PI;
            spriteNode.angle = angle;

            // Set size
            // spriteNode.width = this.spriteSegmentSize;
            // spriteNode.height = this.spriteSegmentSize * 0.3; // Make it thinner like rope

            // Increment active sprite count
            this.activeSpriteCount++;
        }
    }

    enableTouchEvents() {
        // Enable touch events for endpoint nodes in pointList
        for (let obj of this.pointList) {
            if (obj.posA) {
                obj.posA.on(Node.EventType.TOUCH_START, this.onPointTouchStart.bind(this, obj.posA), this);
                obj.posA.on(Node.EventType.TOUCH_MOVE, this.onPointTouchMove.bind(this, obj.posA), this);
                obj.posA.on(Node.EventType.TOUCH_END, this.onPointTouchEnd, this);
            }
            if (obj.posB) {
                obj.posB.on(Node.EventType.TOUCH_START, this.onPointTouchStart.bind(this, obj.posB), this);
                obj.posB.on(Node.EventType.TOUCH_MOVE, this.onPointTouchMove.bind(this, obj.posB), this);
                obj.posB.on(Node.EventType.TOUCH_END, this.onPointTouchEnd, this);
            }
        }
    }

    onPointTouchStart(endPoint: Node, event: EventTouch) {
        this.isSimulatedPhysicsEnabled = true;
        this.enableContinuousAnimation = false;
        this.isDragging = true;
        this.draggedPoint = endPoint;

        // Find which segment contains this point
        this.currentDraggedSegmentIndex = -1;
        for (let i = 0; i < this.ropeSegments.length; i++) {
            let segment = this.ropeSegments[i];
            if (segment.pointA === endPoint || segment.pointB === endPoint) {
                this.currentDraggedSegmentIndex = i;
                break;
            }
        }
    }

    onPointTouchMove(endPoint: Node, event: EventTouch) {
        if (this.isDragging && this.draggedPoint === endPoint) {
            let delta = event.getDelta();
            let newPos = endPoint.getPosition();
            newPos.x += delta.x;
            newPos.y += delta.y;
            endPoint.setPosition(newPos);

            // Apply immediate asymmetric forces during drag movement
            if (this.useAsymmetricForce && this.isSimulatedPhysicsEnabled) {
                this.applyInstantAsymmetricForces(endPoint, delta);
            }
        }
    }

    onPointTouchEnd(event: EventTouch) {
        this.isDragging = false;
        this.draggedPoint = null;
        this.currentDraggedSegmentIndex = -1;
    }

    // Method to toggle between animation and simulated physics mode
    togglePhysicsMode() {
        this.isSimulatedPhysicsEnabled = !this.isSimulatedPhysicsEnabled;
        this.enableContinuousAnimation = !this.isSimulatedPhysicsEnabled;

        if (this.isSimulatedPhysicsEnabled) {
            this.initializeSimulatedRope();
        } else {
            this.ropeSegments = [];
        }
    }

    // Public method to enable simulated physics mode
    public enablePhysicsMode() {
        if (!this.isSimulatedPhysicsEnabled) {
            this.togglePhysicsMode();
        }
    }

    // Public method to enable animation mode
    public enableAnimationMode() {
        if (this.isSimulatedPhysicsEnabled) {
            this.togglePhysicsMode();
        }
    }

    // Additional physics simulation properties
    public setGravity(gravity: number) {
        this.gravity = gravity;
    }

    public setDamping(damping: number) {
        this.damping = Math.max(0, Math.min(1, damping));
    }

    public setSpringStrength(strength: number) {
        this.springStrength = strength;
    }

    public setSegmentLength(length: number) {
        this.segmentLength = Math.max(5, length);

        // Reinitialize rope với segment length mới
        if (this.isSimulatedPhysicsEnabled) {
            this.initializeSimulatedRope();
        }
    }

    public shortenRope(factor: number = 0.8) {
        this.setSegmentLength(this.segmentLength * factor);
    }

    public lengthenRope(factor: number = 1.2) {
        this.setSegmentLength(this.segmentLength * factor);
    }

    // Method để tạo rope ngắn với ít điểm
    public createShortRope(pointCount: number = 5) {
        this.maxRopePoints = pointCount;
        this.springStrength = 2.0; // Tăng spring strength để rope cứng
        this.gravity = 100; // Giảm gravity để ít sag

        if (this.isSimulatedPhysicsEnabled) {
            this.initializeSimulatedRope();
        }
    }

    // Method để tạo rope như trong hình (rất ngắn, ít sag)
    public createTightRope() {
        this.createShortRope(6); // Chỉ 6 điểm
        this.springStrength = 3.0; // Rất cứng
        this.gravity = 50; // Gravity rất nhỏ
        this.damping = 0.95; // Damping cao để ổn định nhanh
    }

    // Asymmetric force control methods
    public enableAsymmetricForce(enable: boolean = true) {
        this.useAsymmetricForce = enable;
    }

    public setAsymmetricForceRatios(draggedEndRatio: number, fixedEndRatio: number) {
        this.draggedEndForceRatio = Math.max(0, Math.min(1, draggedEndRatio));
        this.fixedEndForceRatio = Math.max(0, Math.min(1, fixedEndRatio));
    }

    public createAsymmetricRope() {
        this.useAsymmetricForce = true;
        this.draggedEndForceRatio = 0.1; // Đầu kéo ít bị ảnh hưởng
        this.fixedEndForceRatio = 0.9; // Đầu còn lại bị ảnh hưởng mạnh
        this.springStrength = 2.0; // Tăng spring strength để hiệu ứng rõ ràng hơn
        this.instantForceStrength = 0.7; // Phản ứng mạnh khi drag
    }

    public setInstantForceStrength(strength: number) {
        this.instantForceStrength = Math.max(0, Math.min(1, strength));
    }

    // Dual end oscillation control methods
    public setDualEndOscillation(enable: boolean = true) {
        this.enableDualEndOscillation = enable;
    }

    public setEndOscillationStrength(strength: number) {
        this.endOscillationStrength = Math.max(0, Math.min(1, strength));
    }

    public createDualOscillatingRope() {
        this.enableDualEndOscillation = true;
        this.endOscillationStrength = 0.8;
        this.springStrength = 1.2; // Medium spring for natural oscillation
        this.gravity = 60; // Moderate gravity
        this.damping = 0.85; // Less damping for longer oscillation
        this.instantForceStrength = 0.6;
    }

    public createIntenseOscillatingRope() {
        this.enableDualEndOscillation = true;
        this.endOscillationStrength = 1.0; // Maximum oscillation
        this.springStrength = 0.8; // Lower spring for more flexibility
        this.gravity = 40; // Lower gravity for more dramatic effect
        this.damping = 0.7; // Low damping for persistent oscillation
        this.instantForceStrength = 0.8;
    }

    // Preset cho different drag behaviors
    public createResponsiveRope() {
        this.useAsymmetricForce = true;
        this.draggedEndForceRatio = 0.2;
        this.fixedEndForceRatio = 0.8;
        this.instantForceStrength = 0.8;
        this.springStrength = 1.5;
    }

    public createStableRope() {
        this.useAsymmetricForce = true;
        this.draggedEndForceRatio = 0.4;
        this.fixedEndForceRatio = 0.6;
        this.instantForceStrength = 0.3;
        this.springStrength = 2.0;
    }

    // Methods for sprite rendering
    public enableSpriteRender(enable: boolean = true) {
        this.useSpriteRender = enable;
        if (!enable) {
            this.clearRopeSprites();
        } else if (this.spritePool.length === 0) {
            this.initializeSpritePool();
        }
    }

    // Multiple rope management methods
    // Add to pointList
    public addRope(pointA: Node, pointB: Node) {
        this.pointList.push({ posA: pointA, posB: pointB });

        // If physics is enabled, create rope segment immediately
        if (this.isSimulatedPhysicsEnabled) {
            this.createSimulatedRope(pointA, pointB);
        }

        // Enable touch events for new points
        this.enableTouchEventsForPoint(pointA);
        this.enableTouchEventsForPoint(pointB);
    }

    public removeRope(index: number) {
        if (index >= 0 && index < this.pointList.length) {
            this.pointList.splice(index, 1);

            // Remove corresponding rope segment
            if (index < this.ropeSegments.length) {
                this.ropeSegments.splice(index, 1);
            }
        }
    }

    public clearAllRopes() {
        this.pointList = [];
        this.ropeSegments = [];
    }

    public getRopeCount(): number {
        return this.pointList.length;
    }

    public getRopeSegmentStats() {
        return {
            totalRopes: this.ropeSegments.length,
            totalPoints: this.ropeSegments.reduce((sum, segment) => sum + segment.points.length, 0),
            averagePointsPerRope:
                this.ropeSegments.length > 0
                    ? this.ropeSegments.reduce((sum, segment) => sum + segment.points.length, 0) / this.ropeSegments.length
                    : 0,
        };
    }

    private enableTouchEventsForPoint(point: Node) {
        if (point) {
            point.on(Node.EventType.TOUCH_START, this.onPointTouchStart.bind(this, point), this);
            point.on(Node.EventType.TOUCH_MOVE, this.onPointTouchMove.bind(this, point), this);
            point.on(Node.EventType.TOUCH_END, this.onPointTouchEnd, this);
        }
    }

    // Pre-populate sprite pool to avoid runtime allocation
    initializeSpritePool(initialSize: number = 20) {
        if (!this.ropeSprite) return;

        for (let i = 0; i < initialSize; i++) {
            let spriteNode = new Node();
            spriteNode.parent = this.node;

            // Add sprite component
            let spriteComponent = spriteNode.addComponent(Sprite);
            spriteComponent.spriteFrame = this.ropeSprite;

            // Set z-index to render behind other elements
            spriteNode.setSiblingIndex(-1);

            // Initially hidden
            spriteNode.active = false;

            // Add to pool
            this.spritePool.push(spriteNode);
        }
    }

    // Get pool statistics for debugging
    getPoolStats() {
        return {
            poolSize: this.spritePool.length,
            activeSprites: this.activeSpriteCount,
            unusedSprites: this.spritePool.length - this.activeSpriteCount,
        };
    }

    public setSpriteSegmentSize(size: number) {
        this.spriteSegmentSize = Math.max(5, size);
    }

    public setRopeSprite(spriteFrame: SpriteFrame) {
        this.ropeSprite = spriteFrame;

        // Update existing sprites in pool
        for (let sprite of this.spritePool) {
            let spriteComponent = sprite.getComponent(Sprite);
            if (spriteComponent) {
                spriteComponent.spriteFrame = spriteFrame;
            }
        }
    }

    //
    openMainScene() {
        director.loadScene("main"); // Assuming "MainScene" is the name of your main scene
    }

    createRope() {
        console.log("Creating rope...");
        // Get window size from director's root
        const winSize = director.getScene().getChildByName("Canvas")?.getComponent(UITransform)?.contentSize || { width: 960, height: 640 };
        let randomPos1 = v2(Math.random() * 500 - winSize.width / 2, -winSize.height / 3 + 100);
        let randomPos2 = v2(Math.random() * 500 - winSize.width / 2, winSize.height / 3 - 100);

        let clone1 = instantiate(this.pointPrefab);
        clone1.setPosition(v3(randomPos1.x, randomPos1.y, 0));
        clone1.parent = this.node.parent;
        clone1.active = true;
        this.enableTouchEventsForPoint(clone1);

        let clone2 = instantiate(this.pointPrefab);
        clone2.setPosition(v3(randomPos2.x, randomPos2.y, 0));
        clone2.parent = this.node.parent;
        clone2.active = true;
        this.enableTouchEventsForPoint(clone2);

        this.addRope(clone1, clone2);

        let listPos: Vec3[] = [];
        const padding = 100;
        for (let i = 0; i < 30; i++) {
            let rPos = randomPos2.add(v2(padding + Math.random() * 200, Math.random() * 100 - 100));
            listPos.push(v3(rPos.x, rPos.y, 0));
        }

        tween(clone2)
            .to(0.3, { position: v3(randomPos2.x, randomPos2.y, 0) })
            .start();
        for (let i = 0; i < listPos.length; i++) {
            let pos = listPos[i];
            tween(clone2)
                .delay(0.1 * i + 0.5)
                .to(0.5, { position: pos })
                .call(() => {
                    // After moving, create a new rope segment
                    if (i === listPos.length - 1) {
                        let index = this.pointList.findIndex((obj) => obj.posA === clone1 && obj.posB === clone2);
                        if (index === -1) return;
                        tween(clone1)
                            .to(0.3, { position: v3(pos) })
                            .call(() => {
                                this.scheduleOnce(() => {
                                    this.removeRope(index);
                                    clone1.destroy();
                                    clone2.destroy();
                                });
                            })
                            .start();
                    }
                })
                .start();
        }
    }
}
