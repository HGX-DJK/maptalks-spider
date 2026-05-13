# maptalks-spider

A spider expansion manager plugin for [maptalks](https://maptalks.github.io/) - handles overlapping markers with spiral expansion animation.

## Project Structure

```
maptalks-spider/
├── src/
│   └── SpiderManager.js   # 源码
├── debug/
│   ├── spider-marker.html # 测试页面
│   ├── start.png         # 标记图标
│   └── aoi.png           # 堆叠图标
├── dist/
│   ├── maptalks-spider.js      # UMD 格式
│   └── maptalks-spider.es.js   # ES Module 格式
├── package.json
├── rollup.config.js
└── README.md
```

## Install

```bash
npm install
```

## Build

```bash
npm run build   # 生产构建
npm run dev     # 开发监听模式
```

## Usage

### Browser (Vanilla JS)

```html
<script src="https://unpkg.com/maptalks/dist/maptalks.min.js"></script>
<script src="../dist/maptalks-spider.js"></script>
<script>
const map = new maptalks.Map('map', {
  center: [116.4, 39.9],
  zoom: 12
});

const layer = new maptalks.VectorLayer('spider').addTo(map);
const spider = new maptalks.SpiderManager(layer, {
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

// Click handler for stacked markers
layer.on('click', function(e) {
  const coord = [e.coordinate.x, e.coordinate.y];
  if (spider.isStacked(coord)) {
    spider.spiderfy(coord);
  } else {
    spider.unspiderfy();
  }
});
</script>
```

### ES6 Module

```javascript
import { SpiderManager } from 'maptalks-spider';

const layer = new maptalks.VectorLayer('spider').addTo(map);
const spider = new SpiderManager(layer, {
  spiderRadius: 60,
  spiderLineColor: '#DE3333'
});

spider.addMarker([116.4, 39.9], { id: 1 });
spider.addMarker([116.4, 39.9], { id: 2 });
spider.spiderfy([116.4, 39.9]);
spider.unspiderfy();
```

## API

### Constructor

```javascript
new maptalks.SpiderManager(layer, options)
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