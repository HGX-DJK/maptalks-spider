# maptalks-spider

处理地图上同坐标重叠点的展开/收起动画。当多个标记落在同一位置时，显示一个堆叠标记；点击后螺旋散开显示全部，并绘制中心点到展开点的连线。

## 安装

```bash
npm install maptalks maptalks-spider
```

如需使用 `PointLayer`（配合 maptalks-gl），需额外安装：

```bash
npm install maptalks-gl
```

## 快速开始

### 浏览器引入

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
    stackSymbol: {
      markerType: 'ellipse',
      markerWidth: 36,
      markerHeight: 36,
      markerFill: '#FF5722',
      markerLineColor: '#fff',
      markerLineWidth: 2
    },
    onSpiderMarkerClick(item, marker) {
      marker.setInfoWindow({
        content: `<b>${item.name}</b><br>${item.desc || ''}`,
        autoOpenOn: false
      });
      marker.openInfoWindow();
    }
  });

  spider.setData([
    { coord: [121.507, 31.247], id: 1, name: '星巴克', desc: '咖啡' },
    { coord: [121.507, 31.247], id: 2, name: '瑞幸', desc: '咖啡' },
    { coord: [121.507, 31.247], id: 3, name: '喜茶', desc: '茶饮' }
  ]);
</script>
```

### 模块化引入

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
    console.log('点击了:', item.name);
  }
});

spider.setData([
  { coord: [121.507, 31.247], id: 1, name: 'Point A' },
  { coord: [121.507, 31.247], id: 2, name: 'Point B' }
]);
```

## PointLayer 支持

`PointLayer` 只能存储点类型，展开后的连线是 `LineString`，SpiderManager 会自动创建内部 `VectorLayer` Overlay 来承载。

```js
const pointLayer = new maptalks.PointLayer('markers').addTo(map);

const spider = new SpiderManager(pointLayer, {
  spiderRadius: 40,
  spiderLineColor: '#2196F3'
});

spider.setData([...]);

// 访问内部 overlay（如需自定义样式）
spider.spiderOverlay;
```

## 数据格式

```js
{
  coord: [121.507, 31.247],   // 必须：坐标 [经度, 纬度]
  id: 'store_001',            // 推荐：唯一标识，用于查询和删除
  name: '店铺名称',           // 业务字段，会保留在 item 中
  symbol: {                   // 可选：展开后单个标记的样式
    markerType: 'ellipse',
    markerWidth: 24,
    markerHeight: 24,
    markerFill: '#4CAF50'
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `coord` | `[number, number]` | 是 | `[经度, 纬度]` |
| `id` | `string \| number` | 推荐 | 唯一标识，用于 API 调用 |
| `symbol` | `object` | 否 | 展开后标记的样式，覆盖全局默认 |
| 其他 | `any` | 否 | 业务数据会保留在 item 对象中 |

## 配置项

```js
const spider = new SpiderManager(layer, {
  spiderRadius: 60,        // 展开半径（像素）
  spiderLineColor: '#DE3333', // 连线颜色
  markerSymbol: null,      // 展开后标记的默认样式
  stackSymbol: null,       // 堆叠状态标记的样式
  onSpiderMarkerClick: null // 点击展开标记的回调
});
```

| 配置 | 默认值 | 说明 |
|------|--------|------|
| `spiderRadius` | `60` | 螺旋展开半径 |
| `spiderLineColor` | `#DE3333` | 中心点到标记的连线颜色 |
| `markerSymbol` | `null` | 展开后标记的默认 symbol |
| `stackSymbol` | `null` | 堆叠状态标记的 symbol |
| `onSpiderMarkerClick` | `null` | 点击展开标记时触发 `(item, marker, event) => {}` |

## API

### 增删数据

```js
// 添加单个
spider.addMarker([lng, lat], { id: 1, name: 'A' });

// 批量设置（清空之前的数据）
spider.setData([
  { coord: [lng, lat], id: 1, name: 'A' },
  { coord: [lng, lat], id: 2, name: 'B' }
]);

// 删除单个
spider.removeMarker(id);

// 清空全部
spider.clear();

// 销毁（清空并移除内部 overlay）
spider.dispose();
```

### 展开/收起

```js
// 展开指定坐标
spider.spiderfy([121.507, 31.247]);
spider.spiderfy([121.507, 31.247], { animation: false }); // 无动画

// 收起当前展开
spider.unspiderfy();
spider.unspiderfy({ animation: false }); // 无动画
```

### 状态查询

```js
spider.getActiveCoord();      // 返回当前展开的坐标，无则返回 null
spider.getGroupCount([lng, lat]); // 返回该坐标下的标记数量
spider.isStacked([lng, lat]);    // 是否存在多个重叠
spider.isExpanded();              // 是否有任何展开
spider.isExpanded([lng, lat]);    // 指定坐标是否展开
```

### 标记查询

```js
// 根据 id 获取原始数据
const item = spider.getMarkerById('store_001');

// 根据 id 获取可见的 marker 几何体
// 展开时返回展开后的 marker，未展开时返回堆叠 marker
const marker = spider.getGeometryById('store_001');
```

### 配置更新

```js
spider.setOptions({ spiderRadius: 80 });
const opts = spider.getOptions();
```

## 示例

本地调试示例：

```bash
npm install
npm run build-dev
# 启动静态服务器后访问 debug/ 目录
```

- `debug/spider-marker.html` — VectorLayer 基础示例
- `debug/spider-pointlayer.html` — PointLayer + maptalks-gl 示例

## 常见问题

**Q: 报 `LineString can't be added to PointLayer` 错误**

PointLayer 只能存点，展开后的连线是 LineString。请确保使用的是支持 PointLayer 的 SpiderManager 版本，并正确引入了 maptalks-spider。

**Q: 修改源码后 demo 没变化**

debug 页面加载的是 `dist/maptalks-spider.js`，修改源码后需重新构建：

```bash
npm run build-dev
```

**Q: 坐标精度如何处理**

坐标按 `lng.toFixed(6) + ',' + lat.toFixed(6)` 分组。如需调整精度，需在传入前自行处理坐标。

## License

MIT