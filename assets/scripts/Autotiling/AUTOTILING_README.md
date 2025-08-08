# Autotiling System for Cocos Creator

This autotiling system provides automatic tile placement and visual updates based on neighboring tiles, making it easy to create seamless tile-based environments.

## Features

- **Automatic Tile Rules**: Automatically calculates tile appearance based on neighbors
- **Multiple Tile Types**: Support for Ground, Wall, Water, and Solid tiles
- **47-Tile System**: Full blob autotiling support with corner detection
- **Visual Editor**: Mouse-based tile painting and erasing
- **Pattern Detection**: Recognizes common tile patterns
- **Level Integration**: Compatible with existing LevelDataSO system
- **Performance Optimized**: Efficient grid storage and update algorithms

## Quick Start

### 1. Setup Components

1. Create a new GameObject and add the `Autotiling` component
2. Assign your tile prefab (should have a Sprite component)
3. Assign sprite frames for each tile type:
   - Ground Tiles: Array of 47 sprite frames for ground autotiling
   - Wall Tiles: Array of 47 sprite frames for wall autotiling
   - Water Tiles: Array of 47 sprite frames for water autotiling
   - Solid Tiles: Array of 47 sprite frames for solid autotiling
4. Set tile size (default: 32 pixels)

### 2. Basic Usage

```typescript
import { Autotiling, AutotileType } from './Data/Autotiling';

// Get autotiling component
const autotiling = this.getComponent(Autotiling);

// Place a tile
autotiling.setTile(5, 3, AutotileType.GROUND);

// Remove a tile
autotiling.removeTile(5, 3);

// Fill an area
autotiling.fillRect(0, 0, 10, 10, AutotileType.WATER);

// Clear all tiles
autotiling.clearAllTiles();
```

### 3. Interactive Editor

Add the `AutotilingExample` component for mouse-based editing:

- **Left Click + Drag**: Paint tiles
- **Right Click + Drag**: Erase tiles
- **Number Keys 1-4**: Switch between tile types
- **C Key**: Clear all tiles
- **F Key**: Fill with example pattern

## Tile Types

The system supports four main tile types:

1. **Ground** (`AutotileType.GROUND`): Basic terrain tiles
2. **Wall** (`AutotileType.WALL`): Solid barrier tiles
3. **Water** (`AutotileType.WATER`): Liquid tiles
4. **Solid** (`AutotileType.SOLID`): Dense material tiles

## Autotile Rules

The system uses a comprehensive rule system based on neighbor detection:

- **Basic Rules**: Top, Right, Bottom, Left neighbors
- **Corner Rules**: Diagonal neighbor detection
- **Complex Rules**: Inner corners and transitions

## Sprite Frame Organization

For the 47-tile system, organize your sprite frames in this order:

1. **Tile 0**: Isolated (no neighbors)
2. **Tiles 1-4**: Single edges (top, right, bottom, left)
3. **Tiles 5-8**: Corner pieces (2 adjacent edges)
4. **Tiles 9-12**: T-junctions (3 edges)
5. **Tile 13**: Cross (all 4 edges)
6. **Tiles 14-17**: Inner corners
7. **Tiles 18-46**: Complex combinations and variations

## Advanced Features

### Pattern Detection

```typescript
import { AutotileUtils } from './Data/AutotileUtils';

// Detect patterns around a tile
const pattern = AutotileUtils.detectPattern(tiles, x, y);
console.log(pattern); // "rectangular", "corridor", "corner", etc.
```

### Simplified 16-Tile System

For simpler projects, use the simplified rule system:

```typescript
const simplifiedRule = AutotileUtils.calculateSimplifiedRule(
    hasTop, hasRight, hasBottom, hasLeft
);
const tileIndex = AutotileUtils.getSimplifiedTileIndex(simplifiedRule);
```

### Level Data Integration

Use `TileEditor` for integration with existing level systems:

```typescript
import { TileEditor } from './Data/TileEditor';

const editor = this.getComponent(TileEditor);

// Save level data
const levelData = editor.exportForLevelData();

// Load level data
editor.loadFromLevelData(levelData.cells);
```

### Custom Brushes

```typescript
// Paint with circular brush
editor.paintBrush(x, y, brushSize, AutotileType.GROUND);

// Flood fill area
editor.floodFill(x, y, AutotileType.WATER, AutotileType.GROUND);

// Create shapes
editor.createRectangle(x, y, width, height, AutotileType.WALL);
editor.createCircle(x, y, radius, AutotileType.WATER);
```

## Performance Tips

1. **Batch Updates**: Group multiple tile changes before calling autotiling updates
2. **Use Simplified Rules**: For large maps, consider the 16-tile system
3. **Limit Update Radius**: Only update tiles within visible area
4. **Cache Results**: Store frequently used tile configurations

## Troubleshooting

### Common Issues

1. **Tiles Not Appearing**: Check if tile prefab has Sprite component
2. **Wrong Tile Selection**: Verify sprite frame array order
3. **Performance Issues**: Reduce grid size or use simplified rules
4. **Missing Corners**: Ensure diagonal neighbors are properly detected

### Debug Tips

```typescript
// Check tile data
const tile = autotiling.getTile(x, y);
console.log(`Tile at (${x}, ${y}):`, tile);

// Get statistics
const stats = editor.getTileStatistics();
console.log('Tile counts:', stats);

// Verify autotile rule
console.log('Autotile rule:', tile.rule);
```

## Integration with ThreadJam

The autotiling system is designed to work with the existing ThreadJam project structure:

- Uses existing `ICellData` interface for compatibility
- Integrates with `LevelDataSO` for level saving/loading
- Supports the project's coordinate system
- Compatible with Cocos Creator 3.8.6

## Example Scene Setup

1. Create a new scene
2. Add a GameObject with `Autotiling` component
3. Create a tile prefab with Sprite component
4. Import your autotile sprite sheet
5. Slice the sprite sheet into individual frames
6. Assign frames to the appropriate tile type arrays
7. Add `AutotilingExample` for interactive editing
8. Run the scene and start painting!

This system provides a solid foundation for tile-based level design in your Cocos Creator project.
