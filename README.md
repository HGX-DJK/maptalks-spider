# maptalks-spider

`maptalks-spider` is a spider expansion manager for [maptalks](https://maptalks.org/). It helps when many business points share the same coordinate: the map shows one stacked marker first, then expands all points into a spiral layout when the stacked marker is clicked.

中文说明：这个包用于处理 maptalks 地图上的同坐标重叠点。多个点落在同一个经纬度时，先显示一个堆叠点；点击后按螺旋散开，并绘制中心点到每个展开点的连线。

## Install

```bash
npm install maptalks maptalks-spider
```

If you use `PointLayer` from `maptalks-gl`, install it in your own project as needed:

```bash
npm install maptalks-gl
```

## Quick Start

### Browser Script

Use the UMD build directly in a browser page:

```html
<div id="map" style="width: 100%; height: 100vh;"></div>

<script src="https://unpkg.com/maptalks/dist/maptalks.min.js"></script>
<script src="https://unpkg.com/maptalks-spider/dist/maptalks-spider.js"></script>
<script>
  const map = new maptalks.Map('map', {
    center: [121.507, 31.247],
    zoom: 16
  });

  const layer = new maptalks.VectorLayer('markers').addTo(map);

  const spider = new maptalks.SpiderManager(layer, {
    spiderRadius: 40,
    spiderLineColor: '#4a8af4',
    markerSymbol: {
      markerType: 'ellipse',
      markerWidth: 24,
      markerHeight: 24,
      markerFill: '#4CAF50',
      markerLineColor: '#fff',
      markerLineWidth: 2
    },
    stackSymbol: {
      markerType: 'ellipse',
      markerWidth: 36,
      markerHeight: 36,
      markerFill: '#FF5722',
      markerLineColor: '#fff',
      markerLineWidth: 2
    },
    onSpiderMarkerClick: function (item, marker) {
      marker.setInfoWindow({
        content: '<b>' + item.name + '</b><br>' + (item.desc || ''),
        autoOpenOn: false
      });
      marker.openInfoWindow();
    }
  });

  spider.addMarker([121.507, 31.247], { id: 1, name: 'Starbucks', desc: 'Coffee' });
  spider.addMarker([121.507, 31.247], { id: 2, name: 'Luckin', desc: 'Coffee' });
  spider.addMarker([121.507, 31.247], { id: 3, name: 'Heytea', desc: 'Tea' });
</script>
```

### NPM / Bundler

Use normal static imports in Vite, Webpack, Rollup, or other bundlers:

```js
import * as maptalks from 'maptalks';
import { SpiderManager } from 'maptalks-spider';

const map = new maptalks.Map('map', {
  center: [121.507, 31.247],
  zoom: 16
});

const layer = new maptalks.VectorLayer('markers').addTo(map);

const spider = new SpiderManager(layer, {
  spiderRadius: 40,
  spiderLineColor: '#4a8af4',
  onSpiderMarkerClick(item, marker) {
    marker.setInfoWindow({
      content: `<b>${item.name || 'Point'}</b><br>${item.desc || ''}`,
      autoOpenOn: false
    });
    marker.openInfoWindow();
  }
});

spider.setData([
  { coord: [121.507, 31.247], id: 1, name: 'Point A' },
  { coord: [121.507, 31.247], id: 2, name: 'Point B' },
  { coord: [121.507, 31.247], id: 3, name: 'Point C' }
]);
```

## PointLayer Usage

`PointLayer` can only hold point geometries. Spider expansion needs `LineString` geometries for the spider lines, so `SpiderManager` automatically creates an internal `VectorLayer` overlay when the input layer is a `PointLayer`.

Browser example with `maptalks-gl`:

```html
<div id="map" style="width: 100%; height: 100vh;"></div>

<script src="https://unpkg.com/maptalks-gl/dist/maptalks-gl.js"></script>
<script src="https://unpkg.com/maptalks-spider/dist/maptalks-spider.js"></script>
<script>
  const map = new maptalks.Map('map', {
    center: [121.507, 31.247],
    zoom: 16
  });

  const pointLayer = new maptalks.PointLayer('markers').addTo(map);

  const spider = new maptalks.SpiderManager(pointLayer, {
    spiderRadius: 40,
    spiderLineColor: '#2196F3',
    markerSymbol: {
      markerFile: './start.png',
      markerWidth: 32,
      markerHeight: 32
    },
    stackSymbol: {
      markerFile: './aoi.png',
      markerWidth: 48,
      markerHeight: 48
    },
    onSpiderMarkerClick(item, marker) {
      marker.setInfoWindow({
        content: '<b>' + item.name + '</b><br>' + (item.desc || ''),
        autoOpenOn: false
      });
      marker.openInfoWindow();
    }
  });

  spider.setData([
    { coord: [121.507, 31.247], id: 1, name: 'Point A' },
    { coord: [121.507, 31.247], id: 2, name: 'Point B' },
    { coord: [121.507, 31.247], id: 3, name: 'Point C' }
  ]);
</script>
```

The internal overlay is available as:

```js
spider.spiderOverlay
```

If you implement your own map click handler with `identifyAtPoint`, remember to identify both the original `PointLayer` and `spider.spiderOverlay`.

```js
map.on('click', function (e) {
  const baseGeos = pointLayer.identifyAtPoint(e.containerPoint, { tolerance: 10 }) || [];
  const overlayGeos = spider.spiderOverlay
    ? spider.spiderOverlay.identifyAtPoint(e.containerPoint, { tolerance: 10 }) || []
    : [];

  const geos = baseGeos.concat(overlayGeos);

  for (let i = 0; i < geos.length; i++) {
    const geo = geos[i];

    if (geo._isSpiderStack && geo._spiderCoord) {
      spider.spiderfy(geo._spiderCoord);
      return;
    }

    if (geo._spiderItem) {
      console.log('expanded item:', geo._spiderItem);
      return;
    }
  }

  spider.unspiderfy();
});
```

## Data Format

Each item needs a coordinate. A stable `id` is recommended.

```js
{
  coord: [121.507, 31.247],
  id: 1001,
  name: 'Store A',
  desc: 'Business description',
  symbol: {
    markerType: 'ellipse',
    markerWidth: 24,
    markerHeight: 24,
    markerFill: '#4CAF50'
  }
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `coord` | `[number, number]` | Yes | Coordinate in `[lng, lat]` format |
| `id` | `string \| number` | Recommended | Unique item id, used by query and remove APIs |
| `symbol` | `object` | No | Marker style used after expansion |
| Other fields | `any` | No | Business data preserved on the item |

## Options

```js
const spider = new maptalks.SpiderManager(layer, {
  spiderRadius: 60,
  spiderLineColor: '#DE3333',
  markerSymbol: null,
  stackSymbol: null,
  onSpiderMarkerClick: null
});
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `spiderRadius` | `number` | `60` | Expansion radius |
| `spiderLineColor` | `string` | `'#DE3333'` | Spider line color |
| `markerSymbol` | `object \| null` | `null` | Default symbol for expanded markers |
| `stackSymbol` | `object \| null` | `null` | Symbol for stacked markers |
| `onSpiderMarkerClick` | `function \| null` | `null` | Called when an expanded marker is clicked |

`onSpiderMarkerClick` receives:

```js
function onSpiderMarkerClick(item, marker, event) {}
```

| Argument | Description |
| --- | --- |
| `item` | Original item object passed to `addMarker` or `setData` |
| `marker` | Expanded `maptalks.Marker` |
| `event` | maptalks click event |

## API

### `new SpiderManager(layer, options)`

Create a spider manager.

```js
const spider = new maptalks.SpiderManager(layer, options);
```

`layer` can be a `maptalks.VectorLayer`, `maptalks.PointLayer`, or another compatible maptalks layer.

### `addMarker(coord, properties)`

Add one item.

```js
spider.addMarker([121.507, 31.247], {
  id: 1,
  name: 'Point A'
});
```

Returns the manager instance.

### `setData(data)`

Clear existing data and set items in batch.

```js
spider.setData([
  { coord: [121.507, 31.247], id: 1 },
  { coord: [121.507, 31.247], id: 2 }
]);
```

### `spiderfy(coord, options)`

Expand stacked items at a coordinate.

```js
spider.spiderfy([121.507, 31.247]);
spider.spiderfy([121.507, 31.247], { animation: false });
```

### `unspiderfy(options)`

Collapse the current expanded group.

```js
spider.unspiderfy();
spider.unspiderfy({ animation: false });
```

### `getActiveCoord()`

Get the current expanded coordinate. Returns `null` if nothing is expanded.

```js
const coord = spider.getActiveCoord();
```

### `getGroupCount(coord)`

Get item count at a coordinate.

```js
const count = spider.getGroupCount([121.507, 31.247]);
```

### `isStacked(coord)`

Check whether a coordinate has multiple items.

```js
if (spider.isStacked([121.507, 31.247])) {
  spider.spiderfy([121.507, 31.247]);
}
```

### `isExpanded(coord?)`

Check whether any group, or a specific coordinate, is expanded.

```js
spider.isExpanded();
spider.isExpanded([121.507, 31.247]);
```

### `getMarkerById(id)`

Get the original item by id.

```js
const item = spider.getMarkerById(1);
```

### `getGeometryById(id)`

Get the visible marker geometry by id.

```js
const marker = spider.getGeometryById(1);
```

If the group is collapsed, this returns the stack marker. If the group is expanded, it returns the expanded marker for that item.

### `removeMarker(id)`

Remove an item by id.

```js
const removed = spider.removeMarker(1);
```

Returns `true` when removed, otherwise `false`.

### `clear()`

Clear all items and expansion state.

```js
spider.clear();
```

### `dispose()`

Dispose the manager and remove the internal overlay.

```js
spider.dispose();
```

### `setOptions(options)`

Update options.

```js
spider.setOptions({
  spiderRadius: 80,
  spiderLineColor: '#2196F3'
});
```

### `getOptions()`

Get current options.

```js
const options = spider.getOptions();
```

## Examples in This Repository

- `debug/spider-marker.html`: `VectorLayer` demo.
- `debug/spider-pointlayer.html`: `PointLayer` demo with `maptalks-gl`.

To run the local demos:

```bash
npm install
npm run build-dev
```

Then open the HTML files in `debug/` with a local static server.

## FAQ

### Why do I see `LineString can't be added to PointLayer`?

`PointLayer` can only hold points. Spider lines are `LineString` geometries. Use a version where `SpiderManager` creates the internal overlay for `PointLayer`, and make sure your page loads the latest `dist/maptalks-spider.js`.

### Why does the debug page not reflect my source changes?

The debug pages load `dist/maptalks-spider.js`. After changing `src/SpiderManager.js`, rebuild:

```bash
npm run build-dev
```

### How are duplicate coordinates grouped?

Coordinates are grouped by:

```js
lng.toFixed(6) + ',' + lat.toFixed(6)
```

If your business needs a different precision, normalize coordinates before passing data to `SpiderManager`.

## License

MIT
