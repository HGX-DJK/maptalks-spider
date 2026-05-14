# maptalks-spider

`maptalks-spider` 是一个用于 [maptalks](https://maptalks.org/) 的点位蛛网展开管理器。它适合处理多个业务点位落在同一个坐标上的场景：默认地图上只显示一个堆叠标记，点击后把同坐标的点位按螺旋布局散开，并用连线连接原始坐标。

## 功能特性

- 支持同坐标点位自动分组和堆叠显示。
- 支持点击堆叠点后螺旋展开，展开点可再次点击查看详情。
- 支持 `VectorLayer`。
- 支持 `PointLayer` 等 VT 图层：内部会自动创建 `VectorLayer` overlay 承载展开后的 Marker 和 LineString，避免把线直接加入 `PointLayer`。
- 支持单个添加、批量设置、删除、清空、查询点位和查询几何对象。
- 支持自定义普通点图标、堆叠点图标、蛛网线颜色、展开半径和点击回调。

## 目录结构

```text
maptalks-spider/
  src/
    SpiderManager.js          # 源码
  dist/
    maptalks-spider.js        # UMD 构建产物，浏览器 script 标签使用
    maptalks-spider.es.js     # ES Module 构建产物
  debug/
    spider-marker.html        # VectorLayer 调试页
    spider-pointlayer.html    # PointLayer 调试页
    start.png                 # 展开点图标
    aoi.png                   # 堆叠点图标
  package.json
  rollup.config.js
  README.md
```

## 安装与构建

```bash
npm install
```

开发构建：

```bash
npm run build-dev
```

生产构建：

```bash
npm run build
```

监听构建：

```bash
npm run dev
```

调试页面在 `debug/` 目录下。修改 `src/SpiderManager.js` 后，需要重新构建 `dist/`，因为调试页面默认引用的是 `../dist/maptalks-spider.js`。

## 快速开始

### 浏览器直接使用

```html
<div id="map" style="width: 100%; height: 100vh;"></div>

<script src="https://unpkg.com/maptalks/dist/maptalks.min.js"></script>
<script src="./dist/maptalks-spider.js"></script>
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
    onSpiderMarkerClick: function (item, marker, event) {
      marker.setInfoWindow({
        title: item.name || '点位详情',
        content: '<b>' + item.name + '</b><br>' + (item.desc || ''),
        autoOpenOn: false
      });
      marker.openInfoWindow();
    }
  });

  spider.addMarker([121.507, 31.247], { id: 1, name: '星巴克', desc: '咖啡' });
  spider.addMarker([121.507, 31.247], { id: 2, name: '瑞幸', desc: '咖啡' });
  spider.addMarker([121.507, 31.247], { id: 3, name: '喜茶', desc: '茶饮' });
</script>
```

### ES Module 使用

```js
import { SpiderManager } from 'maptalks-spider';

const layer = new maptalks.VectorLayer('markers').addTo(map);

const spider = new SpiderManager(layer, {
  spiderRadius: 60,
  spiderLineColor: '#DE3333'
});

spider.setData([
  { coord: [121.507, 31.247], id: 1, name: '点位 1' },
  { coord: [121.507, 31.247], id: 2, name: '点位 2' },
  { coord: [121.510, 31.248], id: 3, name: '点位 3' }
]);
```

## PointLayer 使用说明

`PointLayer` 只适合承载点数据，不能直接加入 `LineString`。`SpiderManager` 检测到 `PointLayer` 后，会自动创建一个内部 `VectorLayer` 作为 overlay，用于显示：

- 堆叠点 Marker
- 展开后的单个 Marker
- 中心点到展开点之间的 LineString

示例：

```html
<script src="https://unpkg.com/maptalks-gl/dist/maptalks-gl.js"></script>
<script src="./dist/maptalks-spider.js"></script>
<script>
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
    }
  });

  spider.addMarker([121.507, 31.247], { id: 1, name: '点位 A' });
  spider.addMarker([121.507, 31.247], { id: 2, name: '点位 B' });
  spider.addMarker([121.507, 31.247], { id: 3, name: '点位 C' });
</script>
```

一般情况下，堆叠点和展开点已经绑定了内部点击事件：

- 点击堆叠点：调用 `spiderfy(coord)` 展开。
- 点击展开后的单个点：触发 `onSpiderMarkerClick(item, marker, event)`。

如果你在业务代码里自己用 `identifyAtPoint` 处理点击，需要同时识别 `spider.spiderOverlay`：

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
      console.log('点击展开点', geo._spiderItem);
      return;
    }
  }

  spider.unspiderfy();
});
```

## 数据格式

单个点位至少需要 `coord`，推荐提供稳定的 `id`：

```js
{
  coord: [121.507, 31.247],
  id: 1001,
  name: '星巴克',
  desc: '咖啡门店',
  symbol: {
    markerType: 'ellipse',
    markerWidth: 24,
    markerHeight: 24,
    markerFill: '#4CAF50'
  }
}
```

字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `coord` | `[number, number]` | 是 | 点位经纬度，格式为 `[lng, lat]` |
| `id` | `string \| number` | 推荐 | 点位唯一标识，用于查询和删除 |
| `symbol` | `object` | 否 | 当前点展开后的 Marker 样式 |
| 其他字段 | `any` | 否 | 业务数据，会原样保留到 item 上 |

## 常用示例

### 批量设置数据

```js
spider.setData([
  { coord: [121.507, 31.247], id: 1, name: '点位 1' },
  { coord: [121.507, 31.247], id: 2, name: '点位 2' },
  { coord: [121.510, 31.248], id: 3, name: '点位 3' }
]);
```

### 手动展开和收起

```js
spider.spiderfy([121.507, 31.247]);
spider.unspiderfy();
```

关闭动画：

```js
spider.spiderfy([121.507, 31.247], { animation: false });
spider.unspiderfy({ animation: false });
```

### 点击展开点显示弹窗

```js
const spider = new maptalks.SpiderManager(layer, {
  onSpiderMarkerClick: function (item, marker) {
    marker.setInfoWindow({
      title: item.name || '点位详情',
      content: `
        <div style="min-width: 200px; padding: 12px;">
          <b>${item.name || '未命名点位'}</b>
          <div>${item.desc || '暂无描述'}</div>
          <small>ID: ${item.id}</small>
        </div>
      `,
      autoOpenOn: false
    });
    marker.openInfoWindow();
  }
});
```

### 删除点位

```js
const removed = spider.removeMarker(1001);
console.log(removed); // true 或 false
```

### 判断某个坐标是否堆叠

```js
const coord = [121.507, 31.247];

console.log(spider.isStacked(coord));
console.log(spider.getGroupCount(coord));
```

## 配置项

```js
const spider = new maptalks.SpiderManager(layer, {
  spiderRadius: 60,
  spiderLineColor: '#DE3333',
  markerSymbol: null,
  stackSymbol: null,
  onSpiderMarkerClick: null
});
```

| 配置 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `spiderRadius` | `number` | `60` | 展开半径，单位为屏幕像素换算后的地图距离 |
| `spiderLineColor` | `string` | `'#DE3333'` | 蛛网连线颜色 |
| `markerSymbol` | `object \| null` | `null` | 展开后的单个点默认样式 |
| `stackSymbol` | `object \| null` | `null` | 堆叠点样式 |
| `onSpiderMarkerClick` | `function \| null` | `null` | 点击展开后的单个点时触发 |

`onSpiderMarkerClick` 参数：

```js
function onSpiderMarkerClick(item, marker, event) {}
```

| 参数 | 说明 |
| --- | --- |
| `item` | 添加点位时传入的业务对象 |
| `marker` | 展开后的 maptalks Marker |
| `event` | maptalks 点击事件对象 |

## API

### `new SpiderManager(layer, options)`

创建管理器。

```js
const spider = new maptalks.SpiderManager(layer, options);
```

`layer` 可以是：

- `maptalks.VectorLayer`
- `maptalks.PointLayer`
- 其他兼容的 maptalks 图层

### `addMarker(coord, properties)`

添加单个点位。

```js
spider.addMarker([121.507, 31.247], {
  id: 1,
  name: '点位 1'
});
```

返回 `spider`，可链式调用。

### `setData(data)`

清空已有数据并批量设置。

```js
spider.setData([
  { coord: [121.507, 31.247], id: 1 },
  { coord: [121.507, 31.247], id: 2 }
]);
```

### `spiderfy(coord, options)`

展开指定坐标上的堆叠点。

```js
spider.spiderfy([121.507, 31.247]);
spider.spiderfy([121.507, 31.247], { animation: false });
```

### `unspiderfy(options)`

收起当前展开的点位。

```js
spider.unspiderfy();
spider.unspiderfy({ animation: false });
```

### `getActiveCoord()`

获取当前展开坐标。

```js
const coord = spider.getActiveCoord();
```

没有展开时返回 `null`。

### `getGroupCount(coord)`

获取指定坐标上的点位数量。

```js
const count = spider.getGroupCount([121.507, 31.247]);
```

### `isStacked(coord)`

判断指定坐标是否包含多个点位。

```js
if (spider.isStacked([121.507, 31.247])) {
  spider.spiderfy([121.507, 31.247]);
}
```

### `isExpanded(coord?)`

判断是否有点位处于展开状态。

```js
spider.isExpanded();
spider.isExpanded([121.507, 31.247]);
```

### `getMarkerById(id)`

按 id 获取业务点位对象。

```js
const item = spider.getMarkerById(1);
```

### `getGeometryById(id)`

按 id 获取当前可见的 Marker 几何对象。

```js
const marker = spider.getGeometryById(1);
```

如果该点所在坐标未展开，返回堆叠 Marker；如果已展开，返回对应的展开 Marker。

### `removeMarker(id)`

按 id 删除点位。

```js
spider.removeMarker(1);
```

返回 `true` 表示删除成功，`false` 表示没有找到。

### `clear()`

清空全部点位和展开状态。

```js
spider.clear();
```

### `dispose()`

销毁管理器，并移除内部创建的 overlay。

```js
spider.dispose();
```

### `setOptions(options)`

更新配置。

```js
spider.setOptions({
  spiderRadius: 80,
  spiderLineColor: '#2196F3'
});
```

### `getOptions()`

获取当前配置。

```js
const options = spider.getOptions();
```

## 调试页面

项目内置两个调试页：

- `debug/spider-marker.html`：使用 `VectorLayer`。
- `debug/spider-pointlayer.html`：使用 `PointLayer` 和 `maptalks-gl`。

使用方式：

1. 执行 `npm install`。
2. 执行 `npm run build-dev` 生成 `dist/`。
3. 用本地静态服务器打开 `debug/` 目录下的 HTML。

如果浏览器里打开 PointLayer 页面后点击没有展开，请先确认：

- 页面加载的是最新的 `dist/maptalks-spider.js`。
- `spider.spiderOverlay` 已创建。
- 如果你自己处理地图点击，`identifyAtPoint` 需要同时识别 `spider.spiderOverlay`。

## 常见问题

### 为什么 PointLayer 会报 `LineString can't be added to PointLayer`？

`PointLayer` 只能添加点，不能添加 `LineString`。蛛网展开需要绘制连线，所以 `SpiderManager` 会给 `PointLayer` 自动创建 `VectorLayer` overlay。请确认你使用的是修复后的构建产物。

### 为什么修改源码后 debug 页面没有变化？

debug 页面引用的是 `dist/maptalks-spider.js`，修改 `src/SpiderManager.js` 后需要重新执行：

```bash
npm run build-dev
```

### 同坐标判断为什么使用 6 位小数？

内部通过 `lng.toFixed(6) + ',' + lat.toFixed(6)` 生成分组 key。6 位小数大约能满足米级坐标分组。如果业务需要更粗或更细的聚合粒度，可以在传入数据前自行归一化坐标。

## License

MIT
