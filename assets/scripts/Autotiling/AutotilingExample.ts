import { _decorator, Component, Node, input, Input, EventMouse, Camera, Vec3 } from 'cc';
import { Autotiling, AutotileType } from './Autotiling';
const { ccclass, property } = _decorator;

@ccclass('AutotilingExample')
export class AutotilingExample extends Component {
    @property(Autotiling)
    autotiling: Autotiling = null!;

    @property(Camera)
    camera: Camera = null!;

    @property({ type: [String], displayName: "Tile Types" })
    tileTypeNames: string[] = ['ground', 'wall', 'water', 'solid'];

    private currentTileType: AutotileType = AutotileType.GROUND;
    private isDrawing: boolean = false;
    private isErasing: boolean = false;

    protected onLoad() {
        // Enable input events
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    protected onDestroy() {
        // Disable input events
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    private onMouseDown(event: EventMouse) {
        if (event.getButton() === EventMouse.BUTTON_LEFT) {
            this.isDrawing = true;
            this.paintTile(event);
        } else if (event.getButton() === EventMouse.BUTTON_RIGHT) {
            this.isErasing = true;
            this.eraseTile(event);
        }
    }

    private onMouseMove(event: EventMouse) {
        if (this.isDrawing) {
            this.paintTile(event);
        } else if (this.isErasing) {
            this.eraseTile(event);
        }
    }

    private onMouseUp(event: EventMouse) {
        this.isDrawing = false;
        this.isErasing = false;
    }

    private onKeyDown(event: any) {
        switch (event.keyCode) {
            case 49: // Key '1'
                this.currentTileType = AutotileType.GROUND;
                console.log('Selected: Ground');
                break;
            case 50: // Key '2'
                this.currentTileType = AutotileType.WALL;
                console.log('Selected: Wall');
                break;
            case 51: // Key '3'
                this.currentTileType = AutotileType.WATER;
                console.log('Selected: Water');
                break;
            case 52: // Key '4'
                this.currentTileType = AutotileType.SOLID;
                console.log('Selected: Solid');
                break;
            case 67: // Key 'C'
                this.clearAllTiles();
                break;
            case 70: // Key 'F'
                this.fillExample();
                break;
        }
    }

    private paintTile(event: EventMouse) {
        const worldPos = this.screenToWorldPosition(event.getLocationX(), event.getLocationY());
        const gridPos = this.autotiling.worldToGridPosition(worldPos.x, worldPos.y);
        
        this.autotiling.setTile(gridPos.x, gridPos.y, this.currentTileType);
    }

    private eraseTile(event: EventMouse) {
        const worldPos = this.screenToWorldPosition(event.getLocationX(), event.getLocationY());
        const gridPos = this.autotiling.worldToGridPosition(worldPos.x, worldPos.y);
        
        this.autotiling.removeTile(gridPos.x, gridPos.y);
    }

    private screenToWorldPosition(screenX: number, screenY: number): Vec3 {
        const worldPos = new Vec3();
        if (this.camera) {
            this.camera.screenToWorld(new Vec3(screenX, screenY, 0), worldPos);
        }
        return worldPos;
    }

    private clearAllTiles() {
        this.autotiling.clearAllTiles();
        console.log('All tiles cleared');
    }

    private fillExample() {
        // Create a simple example pattern
        this.autotiling.fillRect(-5, -5, 10, 2, AutotileType.GROUND);
        this.autotiling.fillRect(-3, -3, 6, 6, AutotileType.WATER);
        this.autotiling.fillRect(-2, -2, 4, 4, AutotileType.WALL);
        console.log('Example pattern created');
    }

    /**
     * Public method to set current tile type programmatically
     */
    public setCurrentTileType(type: AutotileType) {
        this.currentTileType = type;
    }

    /**
     * Public method to get current tile type
     */
    public getCurrentTileType(): AutotileType {
        return this.currentTileType;
    }
}
