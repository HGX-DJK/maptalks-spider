# maptalks-spider

A spider expansion manager plugin for [maptalks](https://maptalks.github.io/) - handles overlapping markers with spiral expansion animation.

## Install

```bash
npm install maptalks-spider
```

## Usage

### ES6 Module

```javascript
import { SpiderManager } from 'maptalks-spider';
import VectorLayer from 'maptalks/dist/VectorLayer';
import Map from 'maptalks/dist/Map';

const map = new Map('map', {
  center: [116.4, 39.9],
  zoom: 12
});

const layer = new VectorLayer('spider').addTo(map);
const spider = new SpiderManager(layer, {
  spiderRadius: 60,
  spiderLineColor: '#DE3333'
});

// Add markers at same coordinate (will stack)
spider.addMarker([116.4, 39.9], { id: 1, symbol: { markerFill: '#ff0000' } });
spider.addMarker([116.4, 39.9], { id: 2 });
spider.addMarker([116.4, 39.9], { id: 3 });

// Batch set data
spider.setData([
  { coord: [116.4, 39.9], id: 1 },
  { coord: [116.4, 39.9], id: 2 },
  { coord: [116.5, 40.0], id: 3 }
]);

// Expand/Collapse
spider.spiderfy([116.4, 39.9]);  // expand
spider.unspiderfy();              // collapse

// Click handler for stacked markers
layer.on('click', function(e) {
  const coord = [e.coordinate.x, e.coordinate.y];
  if (spider.isStacked(coord)) {
    spider.spiderfy(coord);
  } else {
    spider.unspiderfy();
  }
});
```

### Browser (Vanilla JS)

```html
<script src="https://unpkg.com/maptalks/dist/maptalks.min.js"></script>
<script src="https://unpkg.com/maptalks-spider/dist/maptalks-spider.js"></script>
```

## API

### Constructor

```javascript
new SpiderManager(layer, options)
```

- `layer` : VectorLayer - maptalks vector layer
- `options` : SpiderOptions (optional)
  - `spiderRadius` : number - Expansion radius (default: 60)
  - `spiderLineColor` : string - Line color (default: '#DE3333')
  - `markerSymbol` : object - Default marker symbol
  - `stackSymbol` : object - Stacked marker symbol
  - `onSpiderMarkerClick` : function - Click callback

### Methods

| Method | Description |
|--------|-------------|
| `addMarker(coord, properties)` | Add single marker |
| `setData(data)` | Batch set markers |
| `spiderfy(coord, options)` | Expand markers at coord |
| `unspiderfy(options)` | Collapse expanded markers |
| `getActiveCoord()` | Get currently expanded coord |
| `getGroupCount(coord)` | Get marker count at coord |
| `isStacked(coord)` | Check if coord has multiple markers |
| `isExpanded(coord?)` | Check if spider is expanded |
| `getMarkerById(id)` | Get marker item by ID |
| `getGeometryById(id)` | Get marker geometry by ID |
| `removeMarker(id)` | Remove marker by ID |
| `clear()` | Clear all markers |
| `dispose()` | Dispose and cleanup |
| `setOptions(options)` | Update options |
| `getOptions()` | Get current options |

## License

MIT