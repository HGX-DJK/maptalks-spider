import * as maptalks from 'maptalks';

var VectorLayer = maptalks.VectorLayer;
var Coordinate = maptalks.Coordinate;
var Point = maptalks.Point;
var LineString = maptalks.LineString;
var Marker = maptalks.Marker;

export var SpiderMarkerItem = {
    coord: [],
    id: null,
    symbol: null
};

export var SpiderOptions = {
    spiderRadius: 60,
    spiderLineColor: '#DE3333',
    markerSymbol: null,
    stackSymbol: null,
    onSpiderMarkerClick: null
};

var SpiderManager = (function () {
    function SpiderManager(layer, options) {
        // layer can be VectorLayer, PointLayer, or any OverlayLayer subclass
        this.layer = layer;
        this.spiderOverlay = null;
        this._vtLayerType = null; // cache for layer type detection
        this.coordGroups = new Map();
        this.stackMarkers = new Map();
        this.geometryLayers = new Map();
        this.expandedMarkers = [];
        this.expandedLines = [];
        this.activeCoord = null;
        this.options = {};
        this.idIndex = new Map();
        this._isAnimating = false;
        this._animationState = null;

        var opts = options || {};
        this.options = {
            spiderRadius: opts.spiderRadius !== undefined ? opts.spiderRadius : 60,
            spiderLineColor: opts.spiderLineColor !== undefined ? opts.spiderLineColor : '#DE3333',
            markerSymbol: opts.markerSymbol !== undefined ? opts.markerSymbol : null,
            stackSymbol: opts.stackSymbol !== undefined ? opts.stackSymbol : null,
            onSpiderMarkerClick: opts.onSpiderMarkerClick !== undefined ? opts.onSpiderMarkerClick : null
        };

        // Detect if this is a VT layer (PointLayer, LineStringLayer) that needs an overlay for Marker geometries.
        this._detectLayerType();
        if (this._vtLayerType === 'vt') {
            this._ensureSpiderOverlay();
        }
    }

    SpiderManager.prototype._detectLayerType = function () {
        var type = this.layer && typeof this.layer.getType === 'function' ? this.layer.getType() : '';
        var ctorName = this.layer && this.layer.constructor ? this.layer.constructor.name : '';
        var jsonType = this.layer && typeof this.layer.getJSONType === 'function' ? this.layer.getJSONType() : '';
        var layerText = '';
        try {
            layerText = this.layer ? String(this.layer) : '';
        } catch (e) {
            layerText = '';
        }
        var layerName = [type, ctorName, jsonType, layerText].join(' ');

        if (/(PointLayer|LineStringLayer)/i.test(layerName)) {
            this._vtLayerType = 'vt';
        } else if ((VectorLayer && this.layer instanceof VectorLayer) || /VectorLayer/i.test(layerName)) {
            this._vtLayerType = 'vector';
        } else {
            this._vtLayerType = 'vt';
        }
    };

    SpiderManager.prototype._ensureSpiderOverlay = function () {
        if (this._vtLayerType !== 'vt') {
            return this.layer;
        }

        if (this.spiderOverlay) {
            return this.spiderOverlay;
        }

        var map = this.layer && this.layer.getMap ? this.layer.getMap() : null;
        if (map) {
            this.spiderOverlay = new VectorLayer('spider-overlay-' + Date.now()).addTo(map);
        }

        return this.spiderOverlay;
    };

    SpiderManager.prototype._getActiveLayer = function () {
        return this._vtLayerType === 'vt' ? this._ensureSpiderOverlay() : this.layer;
    };

    SpiderManager.prototype._addGeometry = function (geometry) {
        var activeLayer = this._getActiveLayer();
        if (!activeLayer) return;

        try {
            activeLayer.addGeometry(geometry);
            this.geometryLayers.set(geometry, activeLayer);
        } catch (e) {
            if (this._vtLayerType !== 'vt' && /PointLayer|LineStringLayer/i.test(e && e.message ? e.message : '')) {
                this._vtLayerType = 'vt';
                activeLayer = this._ensureSpiderOverlay();
                if (activeLayer) {
                    activeLayer.addGeometry(geometry);
                    this.geometryLayers.set(geometry, activeLayer);
                    return;
                }
            }
            throw e;
        }
    };

    SpiderManager.prototype._removeGeometry = function (geometry) {
        var layer = this.geometryLayers.get(geometry) || this._getActiveLayer();
        if (layer) {
            layer.removeGeometry(geometry);
        }
        this.geometryLayers.delete(geometry);
    };

    SpiderManager.prototype._bindMarkerClick = function (marker) {
        if (!marker || marker._spiderClickBound || typeof marker.on !== 'function') {
            return;
        }

        var self = this;
        marker._spiderClickBound = true;
        marker.on('click', function (e) {
            if (e && e.domEvent && typeof e.domEvent.stopPropagation === 'function') {
                e.domEvent.stopPropagation();
            }

            if (marker._isSpiderStack && marker._spiderCoord) {
                self.spiderfy(marker._spiderCoord);
                return;
            }

            if (marker._spiderItem && typeof self.options.onSpiderMarkerClick === 'function') {
                self.options.onSpiderMarkerClick(marker._spiderItem, marker, e);
            }
        });
    };

    SpiderManager.prototype.addMarker = function (coord, properties) {
        var item = properties || {};
        item.coord = coord;

        var key = this._coordKey(coord);
        var existingGroup = this.coordGroups.get(key);

        if (!existingGroup) {
            this.coordGroups.set(key, [item]);
            this._createStackMarker(key, item);
            if (item.id != null) {
                this.idIndex.set(item.id, { coordKey: key, itemIndex: 0 });
            }
        } else {
            var itemIndex = existingGroup.length;
            existingGroup.push(item);
            if (item.id != null) {
                this.idIndex.set(item.id, { coordKey: key, itemIndex: itemIndex });
            }
            if (existingGroup.length === 2) {
                this._convertToStack(key, existingGroup);
            } else {
                var marker = this.stackMarkers.get(key);
                if (marker) {
                    marker._spiderGroup = existingGroup;
                }
            }
        }

        return this;
    };

    SpiderManager.prototype.setData = function (data) {
        this.clear();

        var groups = new Map();
        for (var i = 0; i < data.length; i++) {
            var item = data[i];
            var key = this._coordKey(item.coord);
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            var group = groups.get(key);
            if (group) {
                group.push(item);
                if (item.id != null) {
                    this.idIndex.set(item.id, { coordKey: key, itemIndex: group.length - 1 });
                }
            }
        }

        var groupKeys = Array.from(groups.keys());
        for (var j = 0; j < groupKeys.length; j++) {
            var k = groupKeys[j];
            var g = groups.get(k);
            if (g) {
                this.coordGroups.set(k, g);
                this._createStackMarker(k, g[0], g.length > 1 ? g : undefined);
            }
        }

        return this;
    };

    SpiderManager.prototype.spiderfy = function (coord, options) {
        var opts = options || {};
        if (this._isAnimating) return this;

        var key = this._coordKey(coord);
        var group = this.coordGroups.get(key);

        if (!group || group.length <= 1) {
            return this;
        }

        if (this.activeCoord === key) {
            return this;
        }

        var prevActiveCoord = this.activeCoord;
        this.activeCoord = key;

        if (prevActiveCoord && prevActiveCoord !== key) {
            var prevMarkers = this.expandedMarkers.filter(function (m) { return m._spiderParentKey === prevActiveCoord; });
            var prevLines = this.expandedLines.filter(function (l) {
                var coords = l.getCoordinates();
                var startCoord = Array.isArray(coords) ? coords[0] : coords;
                return this._coordKey([startCoord.x, startCoord.y]) === prevActiveCoord;
            }.bind(this));
            for (var i = 0; i < prevMarkers.length; i++) {
                this._removeGeometry(prevMarkers[i]);
                prevMarkers[i].remove();
            }
            for (var j = 0; j < prevLines.length; j++) {
                this._removeGeometry(prevLines[j]);
                prevLines[j].remove();
            }
            this.expandedMarkers = this.expandedMarkers.filter(function (m) { return m._spiderParentKey !== prevActiveCoord; });
            this.expandedLines = this.expandedLines.filter(function (l) {
                var coords = l.getCoordinates();
                var startCoord = Array.isArray(coords) ? coords[0] : coords;
                return this._coordKey([startCoord.x, startCoord.y]) !== prevActiveCoord;
            }.bind(this));
            var prevStackMarker = this.stackMarkers.get(prevActiveCoord);
            if (prevStackMarker) {
                prevStackMarker.show();
            }
        }

        var spiderRadius = this.options.spiderRadius !== undefined ? this.options.spiderRadius : 60;
        var spiderLineColor = this.options.spiderLineColor !== undefined ? this.options.spiderLineColor : '#DE3333';
        var positions = this._getSpiderPositions(coord, group.length, spiderRadius);
        var enableAnimation = opts.animation !== false;

        for (var k = 0; k < group.length; k++) {
            var line = new LineString([coord, positions[k]], {
                symbol: {
                    lineColor: spiderLineColor,
                    lineWidth: 2,
                    lineOpacity: 0
                }
            });
            this.expandedLines.push(line);
            this._addGeometry(line);
            if (enableAnimation) {
                line.animate({
                    symbol: { lineOpacity: 0.6 }
                }, {
                    duration: 300,
                    easing: 'out'
                });
            } else {
                line.setSymbol({ lineOpacity: 0.6 });
            }
        }

        var newMarkers = [];
        var defaultSymbol = this.options.markerSymbol || this._getDefaultSymbol();

        for (var l = 0; l < group.length; l++) {
            var item = group[l];
            var itemSymbol = item.symbol || defaultSymbol;
            var marker = new Marker(coord, {
                id: 'spider_' + item.id,
                symbol: {
                    markerOpacity: 0,
                    markerSize: 0
                }
            });
            marker._spiderItem = item;
            marker._spiderParentKey = key;
            marker._isSpiderExpanded = true;
            marker._targetPosition = positions[l];
            marker._targetSymbol = itemSymbol;
            this._bindMarkerClick(marker);

            newMarkers.push(marker);
            this.expandedMarkers.push(marker);
            this._addGeometry(marker);
        }

        var stackMarker = this.stackMarkers.get(key);
        if (stackMarker) {
            stackMarker.hide();
        }

        if (enableAnimation) {
            this._isAnimating = true;
            this._animateExpand(newMarkers, positions);
        } else {
            for (var m = 0; m < newMarkers.length; m++) {
                var mk = newMarkers[m];
                mk.setCoordinates(positions[m]);
                mk.setSymbol(Object.assign({}, mk._targetSymbol, {
                    markerOpacity: 1,
                    markerSize: 1
                }));
            }
        }

        return this;
    };

    SpiderManager.prototype._animateExpand = function (markers, positions) {
        var duration = 400;
        var startTime = performance.now();
        var delayStep = 30;
        var self = this;
        var startPositions = markers.map(function (marker) {
            var coord = marker.getCoordinates();
            return [coord.x, coord.y];
        });

        function animateFrame() {
            var elapsed = performance.now() - startTime;
            var allDone = true;

            for (var i = 0; i < markers.length; i++) {
                var marker = markers[i];
                var markerElapsed = Math.max(0, elapsed - i * delayStep);
                var t = Math.min(1, markerElapsed / duration);
                var ease = self._easeOutBack(t);

                var startCoord = startPositions[i];
                var targetCoord = positions[i];
                marker.setCoordinates([
                    startCoord[0] + (targetCoord[0] - startCoord[0]) * ease,
                    startCoord[1] + (targetCoord[1] - startCoord[1]) * ease
                ]);

                marker.setSymbol(Object.assign({}, marker._targetSymbol, {
                    markerOpacity: ease,
                    markerSize: ease
                }));

                if (t < 1) {
                    allDone = false;
                }
            }

            if (!allDone) {
                requestAnimationFrame(animateFrame);
            } else {
                self._isAnimating = false;
            }
        }

        requestAnimationFrame(animateFrame);
    };

    SpiderManager.prototype._easeOutBack = function (t) {
        var c1 = 1.70158;
        var c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    };

    SpiderManager.prototype.unspiderfy = function (options) {
        var opts = options || {};
        var markersToRemove = this.expandedMarkers.filter(function (m) { return m._spiderParentKey === this.activeCoord; }.bind(this));
        var self = this;

        if (!this.activeCoord || markersToRemove.length === 0) {
            this.activeCoord = null;
            this._isAnimating = false;
            this._animationState = null;
            return this;
        }

        var enableAnimation = opts.animation !== false;
        var activeKey = this.activeCoord;
        var stackMarker = this.stackMarkers.get(activeKey);

        var linesToRemove = this.expandedLines.filter(function (l) {
            var coords = l.getCoordinates();
            var startCoord = Array.isArray(coords) ? coords[0] : coords;
            return self._coordKey([startCoord.x, startCoord.y]) === activeKey;
        });

        if (!enableAnimation) {
            this.expandedMarkers = this.expandedMarkers.filter(function (m) { return m._spiderParentKey !== activeKey; });
            this.expandedLines = this.expandedLines.filter(function (l) {
                var coords = l.getCoordinates();
                var startCoord = Array.isArray(coords) ? coords[0] : coords;
                return self._coordKey([startCoord.x, startCoord.y]) !== activeKey;
            });
            for (var i = 0; i < markersToRemove.length; i++) {
                this._removeGeometry(markersToRemove[i]);
                markersToRemove[i].remove();
            }
            for (var j = 0; j < linesToRemove.length; j++) {
                this._removeGeometry(linesToRemove[j]);
                linesToRemove[j].remove();
            }
            if (stackMarker) {
                stackMarker.show();
            }
            this.activeCoord = null;
            this._isAnimating = false;
            this._animationState = null;
            return this;
        }

        this._animationState = {
            activeKey: activeKey,
            stackMarker: stackMarker,
            markersToRemove: markersToRemove,
            linesToRemove: linesToRemove
        };

        var duration = 250;
        var startTime = performance.now();
        var startPositions = markersToRemove.map(function (marker) {
            var coord = marker.getCoordinates();
            return [coord.x, coord.y];
        });

        function animateFrame() {
            if (self._animationState && self._animationState.activeKey !== activeKey) {
                return;
            }

            var elapsed = performance.now() - startTime;
            var t = Math.min(1, elapsed / duration);
            var ease = self._easeInBack(t);

            for (var i = 0; i < markersToRemove.length; i++) {
                var marker = markersToRemove[i];
                var targetCoord = marker._spiderParentKey
                    ? self._coordKeyToCoord(marker._spiderParentKey)
                    : marker.getCoordinates();
                var startCoord = startPositions[i];

                if (t < 1) {
                    marker.setCoordinates([
                        startCoord[0] + (targetCoord[0] - startCoord[0]) * ease,
                        startCoord[1] + (targetCoord[1] - startCoord[1]) * ease
                    ]);

                    marker.setSymbol({
                        markerOpacity: 1 - ease,
                        markerSize: 1 - ease
                    });
                }
            }

            for (var j = 0; j < linesToRemove.length; j++) {
                var line = linesToRemove[j];
                line.setSymbol({
                    lineOpacity: 0.6 * (1 - t)
                });
            }

            if (t < 1) {
                requestAnimationFrame(animateFrame);
            } else {
                self.expandedMarkers = self.expandedMarkers.filter(function (m) { return m._spiderParentKey !== activeKey; });
                self.expandedLines = self.expandedLines.filter(function (l) {
                    var coords = l.getCoordinates();
                    var startCoord = Array.isArray(coords) ? coords[0] : coords;
                    return self._coordKey([startCoord.x, startCoord.y]) !== activeKey;
                });
                for (var k = 0; k < markersToRemove.length; k++) {
                    self._removeGeometry(markersToRemove[k]);
                    markersToRemove[k].remove();
                }
                for (var l = 0; l < linesToRemove.length; l++) {
                    self._removeGeometry(linesToRemove[l]);
                    linesToRemove[l].remove();
                }
                if (stackMarker) {
                    stackMarker.show();
                }
                self.activeCoord = null;
                self._isAnimating = false;
                self._animationState = null;
            }
        }

        this._isAnimating = true;
        requestAnimationFrame(animateFrame);
        return this;
    };

    SpiderManager.prototype._easeInBack = function (t) {
        var c1 = 1.70158;
        var c3 = c1 + 1;
        return c3 * t * t * t - c1 * t * t;
    };

    SpiderManager.prototype.getActiveCoord = function () {
        if (!this.activeCoord) return null;
        var parts = this.activeCoord.split(',');
        return [parseFloat(parts[0]), parseFloat(parts[1])];
    };

    SpiderManager.prototype.getGroupCount = function (coord) {
        var key = this._coordKey(coord);
        var group = this.coordGroups.get(key);
        return group ? group.length : 0;
    };

    SpiderManager.prototype.isStacked = function (coord) {
        return this.getGroupCount(coord) > 1;
    };

    SpiderManager.prototype.isExpanded = function (coord) {
        if (coord) {
            return this._coordKey(coord) === this.activeCoord;
        }
        return this.activeCoord !== null;
    };

    SpiderManager.prototype.clear = function () {
        this.unspiderfy({ animation: false });

        var self = this;
        this.stackMarkers.forEach(function (marker) {
            self._removeGeometry(marker);
            marker.remove();
        });
        this.stackMarkers.clear();
        this.coordGroups.clear();
        this.idIndex.clear();
        this.geometryLayers.clear();
        this.expandedMarkers = [];
        this.expandedLines = [];
        this.activeCoord = null;
        this._isAnimating = false;
        this._animationState = null;
        return this;
    };

    SpiderManager.prototype.dispose = function () {
        this.clear();
        if (this.spiderOverlay) {
            this.spiderOverlay.remove();
            this.spiderOverlay = null;
        }
        this.layer = null;
        this.options = {};
        return this;
    };

    SpiderManager.prototype.getMarkerById = function (id) {
        var idx = this.idIndex.get(id);
        if (!idx) return null;
        var group = this.coordGroups.get(idx.coordKey);
        if (!group) return null;
        return group[idx.itemIndex] || null;
    };

    SpiderManager.prototype.getGeometryById = function (id) {
        var idx = this.idIndex.get(id);
        if (!idx) return null;

        if (this.activeCoord !== idx.coordKey) {
            var sm = this.stackMarkers.get(idx.coordKey);
            return sm || null;
        }
        for (var i = 0; i < this.expandedMarkers.length; i++) {
            if (this.expandedMarkers[i]._spiderItem && this.expandedMarkers[i]._spiderItem.id === id) {
                return this.expandedMarkers[i];
            }
        }
        return null;
    };

    SpiderManager.prototype.removeMarker = function (id) {
        var idx = this.idIndex.get(id);
        if (!idx) return false;

        var coordKey = idx.coordKey;
        var itemIndex = idx.itemIndex;
        var group = this.coordGroups.get(coordKey);
        if (!group) return false;

        if (group.length <= 1) {
            this._removeCoordGroup(coordKey);
            return true;
        }

        group.splice(itemIndex, 1);
        for (var i = itemIndex; i < group.length; i++) {
            var item = group[i];
            if (item.id != null) {
                this.idIndex.set(item.id, { coordKey: coordKey, itemIndex: i });
            }
        }
        this.idIndex.delete(id);

        if (this.activeCoord === coordKey) {
            this.unspiderfy({ animation: false });
            if (group.length > 1) {
                this.spiderfy(group[0].coord, { animation: false });
            }
        } else if (group.length === 1) {
            var marker = this.stackMarkers.get(coordKey);
            if (marker) {
                var sym = group[0].symbol || this.options.markerSymbol || this._getDefaultSymbol(false);
                marker.setSymbol(sym);
                marker._isSpiderStack = false;
                delete marker._spiderGroup;
                delete marker._spiderKey;
                delete marker._spiderCoord;
                marker._spiderItem = group[0];
            }
        } else {
            var marker2 = this.stackMarkers.get(coordKey);
            if (marker2) {
                marker2._spiderGroup = group;
            }
        }

        return true;
    };

    SpiderManager.prototype._removeCoordGroup = function (coordKey) {
        if (this.activeCoord === coordKey) {
            this.unspiderfy({ animation: false });
        }
        var marker = this.stackMarkers.get(coordKey);
        if (marker) {
            this._removeGeometry(marker);
            this.stackMarkers.delete(coordKey);
        }
        var group = this.coordGroups.get(coordKey);
        if (group) {
            for (var i = 0; i < group.length; i++) {
                if (group[i].id != null) {
                    this.idIndex.delete(group[i].id);
                }
            }
        }
        this.coordGroups.delete(coordKey);
    };

    SpiderManager.prototype.setOptions = function (options) {
        this.options = {
            spiderRadius: options.spiderRadius !== undefined ? options.spiderRadius : this.options.spiderRadius,
            spiderLineColor: options.spiderLineColor !== undefined ? options.spiderLineColor : this.options.spiderLineColor,
            markerSymbol: options.markerSymbol !== undefined ? options.markerSymbol : this.options.markerSymbol,
            stackSymbol: options.stackSymbol !== undefined ? options.stackSymbol : this.options.stackSymbol,
            onSpiderMarkerClick: options.onSpiderMarkerClick !== undefined ? options.onSpiderMarkerClick : this.options.onSpiderMarkerClick
        };
        return this;
    };

    SpiderManager.prototype.getOptions = function () {
        return {
            spiderRadius: this.options.spiderRadius,
            spiderLineColor: this.options.spiderLineColor,
            markerSymbol: this.options.markerSymbol,
            stackSymbol: this.options.stackSymbol,
            onSpiderMarkerClick: this.options.onSpiderMarkerClick
        };
    };

    SpiderManager.prototype._coordKey = function (coord) {
        return coord[0].toFixed(6) + ',' + coord[1].toFixed(6);
    };

    SpiderManager.prototype._coordKeyToCoord = function (key) {
        var parts = key.split(',');
        return [parseFloat(parts[0]), parseFloat(parts[1])];
    };

    SpiderManager.prototype._createStackMarker = function (key, item, group) {
        var isStacked = group && group.length > 1;
        var stackSymbol = this.options.stackSymbol;
        var markerSymbol = this.options.markerSymbol;

        var symbol;
        if (isStacked && stackSymbol) {
            symbol = stackSymbol;
        } else if (item.symbol) {
            symbol = item.symbol;
        } else if (markerSymbol) {
            symbol = markerSymbol;
        } else {
            symbol = this._getDefaultSymbol(isStacked);
        }

        var marker = new Marker(item.coord, {
            id: item.id != null ? String(item.id) : key,
            symbol: symbol
        });

        if (isStacked) {
            marker._isSpiderStack = true;
            marker._spiderGroup = group;
            marker._spiderKey = key;
            marker._spiderCoord = item.coord;
        } else {
            marker._spiderItem = item;
        }
        this._bindMarkerClick(marker);

        this.stackMarkers.set(key, marker);
        // Ensure layer type is detected (for setData which doesn't go through constructor)
        if (this._vtLayerType === null) {
            this._detectLayerType();
        }
        this._addGeometry(marker);
    };

    SpiderManager.prototype._convertToStack = function (key, group) {
        var marker = this.stackMarkers.get(key);
        if (!marker) return;

        var stackSymbol = this.options.stackSymbol;
        var markerSymbol = this.options.markerSymbol;
        var stackSym = stackSymbol || group[0].symbol || markerSymbol || this._getDefaultSymbol(true);

        marker.setSymbol(stackSym);
        marker._isSpiderStack = true;
        marker._spiderGroup = group;
        marker._spiderKey = key;
        marker._spiderCoord = group[0].coord;
        delete marker._spiderItem;
    };

    SpiderManager.prototype._getSpiderPositions = function (center, count, radius) {
        if (count === 1) return [center];

        var map = this.layer.getMap();
        if (!map) return [center];

        var centerCoord = new Coordinate(center[0], center[1]);
        var centerPoint = map.coordToContainerPoint(centerCoord);
        var goldenAngle = 37.5;
        var angleStepRad = goldenAngle * Math.PI / 180;

        var positions = new Array(count);
        for (var i = 0; i < count; i++) {
            var r = radius * (0.3 + i * 0.15);
            var angle = i * angleStepRad;
            var px = centerPoint.x + r * Math.cos(angle);
            var py = centerPoint.y + r * Math.sin(angle);
            var coord = map.containerPointToCoord(new Point(px, py));
            positions[i] = [coord.x, coord.y];
        }

        return positions;
    };

    SpiderManager.prototype._getDefaultSymbol = function (stacked) {
        return {
            markerType: 'ellipse',
            markerWidth: stacked ? 36 : 30,
            markerHeight: stacked ? 36 : 30,
            markerFill: stacked ? '#FF5722' : '#4CAF50',
            markerLineColor: '#fff',
            markerLineWidth: 2
        };
    };

    return SpiderManager;
})();

export { SpiderManager };
