# Excalidraw Schema Reference

## 🎯 Objetivo

Este documento serve como referência para o schema de elementos do Excalidraw, essencial para integração com IA.

## 📋 Element Types

Excalidraw suporta os seguintes tipos de elementos:

```typescript
type ExcalidrawElementType = 
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "line"
  | "arrow"
  | "text"
  | "image"
  | "freedraw";
```

## 🔧 Base Element Structure

Todos os elementos compartilham propriedades base:

```typescript
interface ExcalidrawElement {
  // Identification
  id: string;                    // Unique ID (e.g., "abc123def456")
  type: ExcalidrawElementType;   // Element type
  
  // Position & Size
  x: number;                     // X coordinate (top-left)
  y: number;                     // Y coordinate (top-left)
  width: number;                 // Width in pixels
  height: number;                // Height in pixels
  angle: number;                 // Rotation angle in radians (0 = no rotation)
  
  // Visual Properties
  strokeColor: string;           // Stroke color (hex: "#000000")
  backgroundColor: string;       // Fill color (hex: "#ffffff" or "transparent")
  fillStyle: "solid" | "hachure" | "cross-hatch"; // Fill pattern
  strokeWidth: number;           // Stroke width (1-3 typical)
  strokeStyle: "solid" | "dashed" | "dotted"; // Stroke style
  roughness: number;             // Hand-drawn look (0-2, 0 = clean)
  opacity: number;               // Opacity (0-100)
  
  // Grouping & Layering
  groupIds: string[];            // Group IDs this element belongs to
  boundElements: Array<{         // Elements bound to this one
    id: string;
    type: "arrow" | "text";
  }> | null;
  
  // Metadata
  isDeleted: boolean;            // Soft delete flag
  link: string | null;           // Hyperlink URL
  locked: boolean;               // Is element locked from editing
  
  // Versioning (internal)
  version: number;               // Element version
  versionNonce: number;          // Random nonce for version tracking
  updated: number;               // Timestamp of last update
  
  // Custom Data (for extensions)
  customData?: Record<string, any>; // ⚡ IMPORTANT: Store widget/app metadata here
}
```

## 📐 Element-Specific Properties

### Rectangle, Ellipse, Diamond

```typescript
interface ShapeElement extends ExcalidrawElement {
  type: "rectangle" | "ellipse" | "diamond";
  // No additional properties beyond base
}
```

### Line & Arrow

```typescript
interface LinearElement extends ExcalidrawElement {
  type: "line" | "arrow";
  
  points: Array<[number, number]>;  // Array of [x, y] coordinates
  lastCommittedPoint: [number, number] | null;
  
  // Arrow-specific
  startBinding: {                   // Element this arrow starts from
    elementId: string;
    focus: number;                  // Point on element (-1 to 1)
    gap: number;                    // Gap between arrow and element
  } | null;
  
  endBinding: {                     // Element this arrow ends at
    elementId: string;
    focus: number;
    gap: number;
  } | null;
  
  startArrowhead: "arrow" | "bar" | "dot" | null;
  endArrowhead: "arrow" | "bar" | "dot" | null;
}
```

### Text

```typescript
interface TextElement extends ExcalidrawElement {
  type: "text";
  
  text: string;                     // Text content
  fontSize: number;                 // Font size (16, 20, 28, 36)
  fontFamily: 1 | 2 | 3;           // 1=Virgil, 2=Helvetica, 3=Cascadia
  textAlign: "left" | "center" | "right";
  verticalAlign: "top" | "middle";
  baseline: number;                 // Text baseline
  
  // Container binding (text bound to shape)
  containerId: string | null;       // ID of container element
  originalText: string;             // Original text before wrapping
  lineHeight: number;               // Line height multiplier (1.25 default)
}
```

### Image

```typescript
interface ImageElement extends ExcalidrawElement {
  type: "image";
  
  fileId: string;                   // Reference to file in BinaryFiles
  scale: [number, number];          // [scaleX, scaleY]
  status: "pending" | "saved" | "error";
}
```

### Freedraw

```typescript
interface FreeDrawElement extends ExcalidrawElement {
  type: "freedraw";
  
  points: Array<[number, number]>;  // Array of [x, y] coordinates
  pressures: number[];              // Pressure values for each point
  simulatePressure: boolean;        // Simulate pressure if not available
}
```

## 🎨 Default Values

```typescript
const DEFAULT_ELEMENT_PROPS = {
  strokeColor: "#000000",
  backgroundColor: "transparent",
  fillStyle: "hachure",
  strokeWidth: 1,
  strokeStyle: "solid",
  roughness: 1,
  opacity: 100,
  angle: 0,
  groupIds: [],
  boundElements: null,
  isDeleted: false,
  link: null,
  locked: false,
};

const DEFAULT_TEXT_PROPS = {
  fontSize: 20,
  fontFamily: 1, // Virgil (hand-drawn)
  textAlign: "left",
  verticalAlign: "top",
};
```

## 🧹 Schema Filtering for AI

When sending elements to AI, filter out non-semantic properties:

```typescript
/**
 * Properties to KEEP for AI context
 */
const AI_RELEVANT_PROPERTIES = [
  "type",
  "x",
  "y",
  "width",
  "height",
  "angle",
  "text",          // For text elements
  "strokeColor",
  "backgroundColor",
  "groupIds",
  "boundElements",
  "points",        // For lines/arrows
  "startBinding",  // For arrows
  "endBinding",    // For arrows
  "customData",    // For widgets/apps
];

/**
 * Properties to REMOVE (internal/irrelevant)
 */
const AI_IRRELEVANT_PROPERTIES = [
  "id",            // Will be regenerated
  "version",
  "versionNonce",
  "updated",
  "isDeleted",
  "locked",
  "fillStyle",     // Visual detail
  "strokeStyle",   // Visual detail
  "strokeWidth",   // Visual detail
  "roughness",     // Visual detail
  "opacity",       // Visual detail
  "fileId",        // Internal reference
  "baseline",      // Internal text property
  "originalText",  // Internal text property
  "status",        // Transient state
];

function filterElementForAI(element: ExcalidrawElement): Partial<ExcalidrawElement> {
  const filtered: any = {};
  
  for (const key of AI_RELEVANT_PROPERTIES) {
    if (key in element && element[key] !== undefined) {
      filtered[key] = element[key];
    }
  }
  
  return filtered;
}
```

## 📊 JSON Schema for AI_GENERATE_OBJECT

### Schema for Generating Elements

```json
{
  "type": "object",
  "properties": {
    "elements": {
      "type": "array",
      "maxItems": 20,
      "items": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "enum": ["rectangle", "ellipse", "diamond", "text", "arrow", "line"]
          },
          "x": {
            "type": "number",
            "description": "X coordinate (top-left corner)"
          },
          "y": {
            "type": "number",
            "description": "Y coordinate (top-left corner)"
          },
          "width": {
            "type": "number",
            "minimum": 10,
            "description": "Width in pixels"
          },
          "height": {
            "type": "number",
            "minimum": 10,
            "description": "Height in pixels"
          },
          "angle": {
            "type": "number",
            "default": 0,
            "description": "Rotation angle in radians"
          },
          "text": {
            "type": "string",
            "description": "Text content (for text elements)"
          },
          "strokeColor": {
            "type": "string",
            "pattern": "^#[0-9A-Fa-f]{6}$",
            "default": "#000000",
            "description": "Stroke color in hex format"
          },
          "backgroundColor": {
            "type": "string",
            "pattern": "^(#[0-9A-Fa-f]{6}|transparent)$",
            "default": "transparent",
            "description": "Background color or transparent"
          },
          "points": {
            "type": "array",
            "items": {
              "type": "array",
              "items": {
                "type": "number"
              },
              "minItems": 2,
              "maxItems": 2
            },
            "description": "Points for lines and arrows [[x1,y1], [x2,y2], ...]"
          }
        },
        "required": ["type", "x", "y", "width", "height"],
        "allOf": [
          {
            "if": {
              "properties": { "type": { "const": "text" } }
            },
            "then": {
              "required": ["text"]
            }
          },
          {
            "if": {
              "properties": { "type": { "enum": ["line", "arrow"] } }
            },
            "then": {
              "required": ["points"]
            }
          }
        ]
      }
    },
    "note": {
      "type": "string",
      "description": "Brief explanation of what you generated"
    }
  },
  "required": ["elements"]
}
```

## 🎯 Common Patterns

### Creating a Simple Rectangle

```typescript
{
  id: generateId(),
  type: "rectangle",
  x: 100,
  y: 100,
  width: 200,
  height: 100,
  angle: 0,
  strokeColor: "#000000",
  backgroundColor: "#ffc0cb",
  fillStyle: "solid",
  strokeWidth: 2,
  strokeStyle: "solid",
  roughness: 0,
  opacity: 100,
  groupIds: [],
  boundElements: null,
  version: 1,
  versionNonce: randomNonce(),
  isDeleted: false,
  updated: Date.now(),
}
```

### Creating Text

```typescript
{
  id: generateId(),
  type: "text",
  x: 100,
  y: 100,
  width: 200,
  height: 50,
  angle: 0,
  text: "Hello World",
  fontSize: 20,
  fontFamily: 1,
  textAlign: "left",
  verticalAlign: "top",
  strokeColor: "#000000",
  backgroundColor: "transparent",
  // ... other base properties
}
```

### Creating an Arrow

```typescript
{
  id: generateId(),
  type: "arrow",
  x: 100,
  y: 100,
  width: 200,
  height: 0,
  angle: 0,
  points: [[0, 0], [200, 0]], // Horizontal arrow
  strokeColor: "#000000",
  backgroundColor: "transparent",
  startBinding: null, // Or bind to element
  endBinding: null,
  startArrowhead: null,
  endArrowhead: "arrow",
  // ... other base properties
}
```

### Binding Arrow to Elements

```typescript
// Arrow connecting two rectangles
{
  type: "arrow",
  // ... other properties
  startBinding: {
    elementId: "rectangle1_id",
    focus: 0,      // Center of the element
    gap: 5,        // 5px gap
  },
  endBinding: {
    elementId: "rectangle2_id",
    focus: 0,
    gap: 5,
  },
}

// Update bound elements
rectangle1.boundElements = [
  { id: "arrow_id", type: "arrow" }
];
```

### Grouping Elements

```typescript
const groupId = generateId();

element1.groupIds = [groupId];
element2.groupIds = [groupId];
element3.groupIds = [groupId];
```

## 🧩 Custom Data for Widgets/Apps

Use `customData` field to store metadata:

```typescript
// Widget metadata
{
  type: "rectangle",
  // ... other properties
  customData: {
    __webdraw: {
      type: "widget",
      widgetType: "button",
      widgetId: "widget_123",
      config: {
        label: "Click Me",
        style: "primary",
        color: "#3B82F6",
      },
      expansionPromptTemplate: "Create a {style} button...",
    }
  }
}

// Inline app metadata
{
  type: "rectangle",
  // ... other properties
  customData: {
    __webdraw: {
      type: "inline-app",
      appId: "app_123",
      html: "<!DOCTYPE html>...",
      permissions: {
        readElements: true,
        writeElements: false,
      },
    }
  }
}

// Tool widget metadata
{
  type: "rectangle",
  // ... other properties
  customData: {
    __webdraw: {
      type: "tool-widget",
      toolId: "DATABASES_RUN_SQL",
      instanceId: "tool_widget_123",
      config: {
        sql: "SELECT * FROM users",
        displayMode: "table",
      },
      lastExecution: {
        timestamp: 1234567890,
        result: [...],
      },
    }
  }
}
```

## 📚 References

- [Excalidraw GitHub](https://github.com/excalidraw/excalidraw)
- [Excalidraw Element Types](https://github.com/excalidraw/excalidraw/blob/master/src/element/types.ts)
- [Excalidraw API](https://docs.excalidraw.com/docs/@excalidraw/excalidraw/api)

## 🔄 Versioning

This reference is based on:
- **Excalidraw version**: Latest (check package.json)
- **Last updated**: 2025-10-05
- **Schema version**: 1.0

⚠️ **Note**: Excalidraw schema may change in future versions. Always verify against the official documentation.
