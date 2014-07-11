(function() {
var m = Math,
mround = function(r) {
    return r >> 0;
},
hasTouch = 'ontouchstart' in window,
hasTransform = 'webkitTransform' in document.documentElement.style,
START_EV = hasTouch ? 'touchstart' : 'mousedown',
MOVE_EV = hasTouch ? 'touchmove' : 'mousemove',
END_EV = hasTouch ? 'touchend' : 'mouseup',
CANCEL_EV = hasTouch ? 'touchcancel' : 'mouseup',
trnOpen = 'translate3d(0,',
trnClose = ',0)',
requestAnimationFrame = (function() {
    return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
    function(callback) {
        return setTimeout(callback, 1);
    }
})(),
cancelAnimationFrame = (function() {
    return window.cancelRequestAnimationFrame || window.webkitCancelAnimationFrame || window.webkitCancelRequestAnimationFrame || window.mozCancelRequestAnimationFrame || window.oCancelRequestAnimationFrame || window.msCancelRequestAnimationFrame || clearTimeout
})();

function scrollView(el, options) {
    var that = this,
        doc = document,
        i;

    that.wrapper = typeof el == 'object' ? el : doc.getElementById(el);
    that.wrapper.style.overflow = 'hidden';
    that.scroller = that.wrapper.children[0];
    that.options = {
        vScroll: true,
        y: 0,
        bounce: true,
        bounceLock: false,
        momentum: true,
        lockDirection: true,
        useTransform: true,
        topOffset: 0,
        checkDOMChanges: false,
        onRefresh: null,
        onBeforeScrollStart: function(e) {
            e.preventDefault();
        },
        onScrollStart: null,
        onBeforeScrollMove: null,
        onScrollMove: null,
        onBeforeScrollEnd: null,
        onScrollEnd: null,
        onTouchEnd: null,
        onDestroy: null
    };

    for (i in options) that.options[i] = options[i];
    that.y = that.options.y;

    that.scroller.style['webkitTransitionProperty'] = '-webkit-transform';
    that.scroller.style['webkitTransitionDuration'] = '0';
    that.scroller.style['webkitTransformOrigin'] = '0 0';
    that.scroller.style['webkitTransform'] = trnOpen + that.y + 'px' + trnClose;
    this.wrapperH = this.options.wrapperHeight;
    this.scrollerH = this.options.scrollerHeight;
    that.refresh();
    that._bind(START_EV);
};

scrollView.prototype = {
    enabled: true,
    y: 0,
    steps: [],
    currPageY: 0,
    pagesY: [],
    aniTime: null,
    handleEvent: function(e) {
        var that = this;
        switch (e.type) {
        case START_EV:
            if (!hasTouch && e.button !== 0) return;
            that._start(e);
            break;
        case MOVE_EV:
            that._move(e);
            break;
        case END_EV:
        case CANCEL_EV:
            that._end(e);
            break;
        }
    },
    _scrollbar: function (dir) {
        var that = this,
            bar;

        if (!that['vScrollbarWrapper']) {
            bar = document.createElement('div');
            bar.style.cssText = 'position:absolute;z-index:100;width:7px;bottom:2px;top:2px;right:1px';

            bar.style.cssText += ';pointer-events:none;-webkit-transition-property:opacity;-webkit-transition-duration:' + (that.options.fadeScrollbar ? '350ms' : '0') + ';overflow:hidden;opacity:' + (that.options.hideScrollbar ? '0' : '1');

            that.wrapper.appendChild(bar);
            that['vScrollbarWrapper'] = bar;
            bar = document.createElement('div');
            if (!that.options.scrollbarClass) {
                bar.style.cssText = 'position:absolute;z-index:100;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.9);-webkit-background-clip:padding-box;-webkit-box-sizing:border-box;width:100%;-webkit-border-radius:3px;border-radius:3px';
            }
            bar.style.cssText += ';pointer-events:none;-webkit-transition-property:-webkit-transform;-webkit-transition-timing-function:cubic-bezier(0.33,0.66,0.66,1);-webkit-transition-duration:0;-webkit-transform: translate(0,0,0)';
            that['vScrollbarWrapper'].appendChild(bar);
            that['vScrollbarIndicator'] = bar;
        }

        that.vScrollbarSize = that.vScrollbarWrapper.clientHeight;
        that.vScrollbarIndicatorSize = m.max(m.round(that.vScrollbarSize * that.vScrollbarSize / that.scrollerH), 20);
        that.vScrollbarIndicator.style.height = that.vScrollbarIndicatorSize + 'px';
        that.vScrollbarMaxScroll = that.vScrollbarSize - that.vScrollbarIndicatorSize;
        that.vScrollbarProp = that.vScrollbarMaxScroll / that.maxScrollY;
        that._scrollbarPos(true);
    },
    _scrollbarPos: function (hidden) {
        var that = this,
            pos = that.y,
            size;

        if (!that['vScrollbar']) return;

        pos = that['vScrollbarProp'] * pos;
        that['vScrollbarWrapper'].style.webkitTransitionDelay = '0';
        that['vScrollbarWrapper'].style.opacity = hidden && that.options.hideScrollbar ? '0' : '.8';
        that['vScrollbarIndicator'].style.webkitTransform = 'translate3d(0,' + pos + 'px,0)';
    },
    _pos: function(y) {
        this.scroller.style.webkitTransform = trnOpen + y + 'px' + trnClose;
        this.y = y;
        this.options.onPosition && this.options.onPosition.call(this, this.y);
        
        this._scrollbarPos();
    },
    _start: function(e) {
        var that = this,
            point = hasTouch ? e.touches[0] : e,
            matrix, y, c;

        if (!that.enabled) return;

        if (that.options.onBeforeScrollStart) that.options.onBeforeScrollStart.call(that, e);

        that.moved = false;
        that.animating = false;
        that.distY = 0;
        that.absDistY = 0;
        that.dirY = 0;

        if (that.options.momentum) {
            matrix = getComputedStyle(that.scroller, null)['webkitTransform'].replace(/[^0-9-.,]/g, '').split(',');
            y = matrix[5] * 1;

            if (y != that.y) {
                cancelAnimationFrame(that.aniTime);
                that.steps = [];
                that._pos(y);

                that.options.onScrollTerminated && that.options.onScrollTerminated();
            }
        }

        that.absStartY = that.y;
        that.startY = that.y;
        that.pointY = point.pageY;

        that.startTime = e.timeStamp || Date.now();

        if (that.options.onScrollStart) that.options.onScrollStart.call(that, e);

        that._bind(MOVE_EV);
        that._bind(END_EV);
        that._bind(CANCEL_EV);
    },

    _move: function(e) {
        var that = this,
            point = hasTouch ? e.touches[0] : e,
            deltaY = point.pageY - that.pointY,
            newY = that.y + deltaY,
            timestamp = e.timeStamp || Date.now();

        if (that.options.onBeforeScrollMove) that.options.onBeforeScrollMove.call(that, e);

        that.pointX = point.pageX;
        that.pointY = point.pageY;

        if (newY > that.minScrollY || newY < that.maxScrollY) {
            newY = that.options.bounce ? that.y + (deltaY / 2) : newY >= that.minScrollY || that.maxScrollY >= 0 ? that.minScrollY : that.maxScrollY;
        }

        that.distY += deltaY;
        that.absDistY = Math.abs(that.distY);

        if (that.absDistY < 6) {
            return;
        }

        that.moved = true;
        that._pos(newY);
        that.dirY = deltaY > 0 ? -1 : deltaY < 0 ? 1 : 0;

        if (timestamp - that.startTime > 300) {
            that.startTime = timestamp;
            that.startY = that.y;
        }

        if (that.options.onScrollMove) that.options.onScrollMove.call(that, e);
    },

    _end: function(e) {
        if (hasTouch && e.touches.length != 0) return;

        var that = this,
            point = hasTouch ? e.changedTouches[0] : e,
            target, ev, momentumY = {
                dist: 0,
                time: 0
            },
            duration = (e.timeStamp || Date.now()) - that.startTime,
            newPosY = that.y,
            distY, newDuration;

        that._unbind(MOVE_EV);
        that._unbind(END_EV);
        that._unbind(CANCEL_EV);

        if (that.options.onBeforeScrollEnd) that.options.onBeforeScrollEnd.call(that, e);
        if (!that.moved) {
            that._resetPos(200);
            if (that.options.onTouchEnd) that.options.onTouchEnd.call(that, e);
            return;
        }

        if (duration < 300 && that.options.momentum) {
            momentumY = newPosY ? that._momentum(newPosY - that.startY, duration, -that.y, (that.maxScrollY < 0 ? that.scrollerH - that.wrapperH + that.y - that.minScrollY : 0), that.options.bounce ? that.wrapperH : 0) : momentumY;
            newPosY = that.y + momentumY.dist;
            if ((that.y > that.minScrollY && newPosY > that.minScrollY) || (that.y < that.maxScrollY && newPosY < that.maxScrollY)) momentumY = {
                dist: 0,
                time: 0
            };
        }

        if (momentumY.dist) {
            newDuration = m.max(momentumY.time, 10);
            that.scrollTo(mround(newPosY), newDuration);

            if (that.options.onTouchEnd) that.options.onTouchEnd.call(that, e);
            return;
        }

        that._resetPos(200);
        if (that.options.onTouchEnd) that.options.onTouchEnd.call(that, e);
    },
    _resetPos: function(time) {
        var that = this,
            resetY = that.y >= that.minScrollY || that.maxScrollY > 0 ? that.minScrollY : that.y < that.maxScrollY ? that.maxScrollY : that.y;

        if (resetY == that.y) {
            if (that.moved) {
                that.moved = false;
                if (that.options.onScrollEnd) that.options.onScrollEnd.call(that);
            }
            
            if (that.vScrollbar && that.options.hideScrollbar) {
                that.vScrollbarWrapper.style.webkitTransitionDelay = '300ms';
                that.vScrollbarWrapper.style.opacity = '0';
            }

            return;
        }

        that.scrollTo(resetY, time || 0);
    },
    _mouseout: function(e) {
        var t = e.relatedTarget;

        if (!t) {
            this._end(e);
            return;
        }

        while (t = t.parentNode) if (t == this.wrapper) return;

        this._end(e);
    },
    _startAni: function() {
        var that = this,
            startY = that.y,
            startTime = Date.now(),
            step, easeOut, animate;

        if (that.animating) return;

        if (!that.steps.length) {
            that._resetPos(400);
            return;
        }

        step = that.steps.shift();

        if (step.y == startY) step.time = 0;

        that.animating = true;
        that.moved = true;

        animate = function() {
            var now = Date.now(),
                newY;

            if (now >= startTime + step.time) {
                that._pos(step.y);
                that.animating = false;
                if (that.options.onAnimationEnd) that.options.onAnimationEnd.call(that);
                that._startAni();
                return;
            }

            now = (now - startTime) / step.time - 1;
            easeOut = m.sqrt(1 - now * now);
            newY = (step.y - startY) * easeOut + startY;
            that._pos(newY);
            if (that.animating) that.aniTime = requestAnimationFrame(animate);
        };

        animate();
    },
    _momentum: function(dist, time, maxDistUpper, maxDistLower, size) {
        var deceleration = 0.0006,
            speed = Math.abs(dist) / time,
            newDist = (speed * speed) / (2 * deceleration),
            newTime = 0,
            outsideDist = 0;

        if (dist > 0 && newDist > maxDistUpper) {
            outsideDist = size / (6 / (newDist / speed * deceleration));
            maxDistUpper = maxDistUpper + outsideDist;
            speed = speed * maxDistUpper / newDist;
            newDist = maxDistUpper;
        } else if (dist < 0 && newDist > maxDistLower) {
            outsideDist = size / (6 / (newDist / speed * deceleration));
            maxDistLower = maxDistLower + outsideDist;
            speed = speed * maxDistLower / newDist;
            newDist = maxDistLower;
        }

        newDist = newDist * (dist < 0 ? -1 : 1);
        newTime = speed / deceleration;
        return {
            dist: newDist,
            time: mround(newTime)
        };
    },
    _bind: function(type, el, bubble) {
        (el || this.scroller).addEventListener(type, this, !! bubble);
    },
    _unbind: function(type, el, bubble) {
        (el || this.scroller).removeEventListener(type, this, !! bubble);
    },
    destroy: function() {
        var that = this;

        that.scroller.style['webkitTransform'] = '';
        that.vScrollbar = false;
        that._scrollbar();
        that._unbind(START_EV);
        that._unbind(MOVE_EV);
        that._unbind(END_EV);
        that._unbind(CANCEL_EV);

        if (!that.options.hasTouch) {
            that._unbind('mouseout', that.wrapper);
        }

        if (that.options.onDestroy) that.options.onDestroy.call(that);
    },

    refresh: function() {
        var that = this,
            offset, i, l, els, pos = 0,
            page = 0;


        that.wrapperH = that.wrapper.clientHeight || 1;
        that.minScrollY = -that.options.topOffset || 0;
        that.maxScrollY = that.wrapperH - that.scrollerH + that.minScrollY;
        that.dirY = 0;

        if (that.options.onRefresh) that.options.onRefresh.call(that);
        that.vScroll = that.options.vScroll && (!that.options.bounceLock || that.scrollerH > that.wrapperH);
        that.vScrollbar = that.vScroll && that.options.vScrollbar && that.scrollerH > that.wrapperH;
        that.scroller.style['webkitTransitionDuration'] = '0';
        
        that._scrollbar();
        that._resetPos(200);
    },
    updateMaxScroll: function(scrollerH) {
        this.scrollerH = scrollerH;
        this.maxScrollY = this.wrapperH - this.scrollerH;
        this._scrollbar();
    },
    scrollTo: function(y, time, relative) {
        var that = this,
            i, l;
        step = [{
            y: y,
            time: time,
            relative: relative
        }];

        that.stop();
        for (i = 0, l = step.length; i < l; i++) {
            if (step[i].relative) {
                step[i].y = that.y - step[i].y;
            }
            that.steps.push({
                y: step[i].y,
                time: step[i].time || 0
            });
        }

        that._startAni();
    },
    disable: function() {
        this.stop();
        this._resetPos(0);
        this.enabled = false;
        this._unbind(MOVE_EV);
        this._unbind(END_EV);
        this._unbind(CANCEL_EV);
    },
    enable: function() {
        this.enabled = true;
    },
    stop: function() {
        cancelAnimationFrame(this.aniTime);
        this.steps = [];
        this.moved = false;
        this.animating = false;
    },
    isReady: function() {
        return !this.moved && !this.animating;
    }
};

function translate(el, n) {
    el.style.webkitTransform = trnOpen + n + 'px' + trnClose;
}

function findClose(arr, v, start, end) {
    if (start === undefined) {
        start = 0;
    }
    
    if (end === undefined) {
        end = arr.length;
    }
    
    if (end - start < 2) {
        if (arr[start] === v) {
            return start;
        } else if (arr[end - 1] === v) {
            return end;
        } else {
            return (arr[start] - v < arr[end] - v) ? start : end - 1;
        }
    }
    
    var mid = ( start + end ) >> 1,
        val = arr[mid];
    
    if (val === v) {
        return mid;
    } else if (val > v) {
        return findClose(arr, v, start, mid);
    } else {
        return findClose(arr, v, mid, end);
    }
}

function tmpl(_t, data) {
    var _data = [],
        v = {};
    v.last = _t.replace(/([\s\S]*?)(?:<%((?:\=|\$\/)?)([\s\S]*?)%>)/g, function(m, s, t, c, i) {
        v["s_" + i] = s;
        _data.push("res.push(v.s_" + i + ");");
        if (t === "=") {
            _data.push("res.push(" + c.trim() + ");");
        } else {
            _data.push(c.trim());
        }
        return "";
    });
    
    try {
        var _ = new Function("data", "res", "v", _data.join("") + "res.push(v.last);return String.prototype.concat.apply('', res);").toString();
        return eval("(" + _ + ")")(data || {}, [], v);
    } catch (e) {
        console.error("Template Error.", e);
        console.log(_);
    }
}

function trim(s) {
    return s.replace(/^\s*/, '').replace(/\s*$/, '');
}

function ListView(options) {
    this.options = options;
    this.scrollBody = options.scrollBody;
    this.template = trim(options.template);
    
    var matches = this.template.match(/^<([a-zA-Z]+)([^>]*)>([\s\S]*)<\/\1>\s*$/);
    this.itemNodeType = matches[1];
    this.itemAttrs = {};
    var itemAttrs = trim(matches[2]);
    itemAttrs = itemAttrs.split(' ');
    if (itemAttrs.length) {
        for (var i = 0; i < itemAttrs.length; i ++) {
            var attrPair = itemAttrs[i].split('=');
            var key = attrPair[0];
            var value = attrPair[1].replace(/"(\S*)"/, "$1");
            this.itemAttrs[key] = value; 
        }
    }
    this.itemTemplate = matches[3];
    
    this.itemHeight = options.itemHeight;
    this.itemPositions = [];
    this.oriDataList = options.dataList;
    this.maxHeight = options.dataList.length * this.itemHeight;
    this.dataList = [];
    this.formatData();
    this.initItemContainers();
    this.initFirstScreen();
    this.initScroller();
};

ListView.prototype.topItemIndex = 0;
ListView.prototype.screenTopEdge = 0;
ListView.prototype.itemHeight = 140,
ListView.prototype.formatData = function(offset) {
    var ori = this.oriDataList,
        height = this.itemHeight,
        offset = offset || 0,
        itemData,
        translateY;

    for (var i = offset, j = ori.length; i < j; i++) {
        translateY = i * height;
        itemData = {};
        itemData.content = this.replaceTpl(ori[i]);
        itemData.translateY = translateY;
        this.dataList.push(itemData);
        this.itemPositions[i] = translateY;
    }
};

ListView.prototype.updateDataItem = function(index, data) {
    for (var k in data) {
        this.oriDataList[index][k] = data[k];
    }

    this.dataList[index].content = this.replaceTpl(this.oriDataList[index]);
};

ListView.prototype.initItemContainers = function() {
    this.itemContainers = [];
    this.scrollWrapper = this.scrollBody.parentNode;
    this.wrapperHeight = this.scrollWrapper.offsetHeight;
    var n = Math.ceil(this.wrapperHeight / this.itemHeight) + 1,
        itemHeight = this.itemHeight,
        scrollBody = this.infiniteElement ? this.infiniteElement : this.scrollBody,
        i, itemNode;

    n = Math.min(n, this.dataList.length);
    
    for (i = 0; i < n; i++) {
        itemNode = document.createElement(
        this.itemNodeType);

        itemNode.style.position = 'absolute';
        itemNode.style.left = 0;
        itemNode.style.right = 0;
        itemNode.setAttribute('data-index', i);
        translate(itemNode, this.dataList[i].translateY);

        for (var k in this.itemAttrs) {
            itemNode.setAttribute(k, this.itemAttrs[k]);
        }

        scrollBody.appendChild(itemNode);
        this.itemContainers.push(itemNode);
    }
    
    this.containerCount = n;

    this.screenTopEdge = 0;
};

ListView.prototype.initFirstScreen = function() {
    var itemContainers = this.itemContainers,
        dataList = this.dataList,
        l = itemContainers.length;

    for (var i = 0; i < l; i++) {
        itemContainers[i].innerHTML = dataList[i].content;
    }
};

ListView.prototype.replaceTpl = function(itemData) {
    return tmpl(this.itemTemplate, itemData);
};

ListView.prototype.initScroller = function() {
    var t = this,
        settings = {
            bounce: true,
            vScrollbar: true,
            hideScrollbar: true,
            fadeScrollbar: true,
            wrapperHeight: t.wrapperHeight,
            scrollerHeight: t.maxHeight,
            onPosition: function(y) {
                t.onTranslateChange.call(t, y);
            }
        },
        prop, val;

    for (k in t.options) {
        val = t.options[k];
        if (k.indexOf('Scroll') > -1) {
            settings[k] = val;
        }
    }

    this.scroller = new scrollView(this.scrollWrapper, settings);
};

ListView.prototype.onTranslateChange = function(y) {
    if (y > 0 || y < this.scroller.maxScrollY) {
        if (this.options.onScroll) {
            this.options.onScroll.apply(this, [y]);
        }
        return;
    }

    this.screenTopEdge = Math.abs(y);
    var containerLength = this.itemContainers.length,
        listLength = this.dataList.length,
        maxTopIndex = listLength - containerLength + 1,
        prevTopIndex = this.topItemIndex,
        currentTopIndex = findClose(this.itemPositions, this.screenTopEdge),
        changed, newIndex, container, i;

    if (prevTopIndex != currentTopIndex && currentTopIndex < maxTopIndex) {
        if (currentTopIndex > prevTopIndex) {
            changed = currentTopIndex - prevTopIndex;
            for (i = 0; i < changed; i++) {
                newIndex = prevTopIndex + containerLength + i;
                container = this.itemContainers.shift();
                this.itemContainers.push(container);
                this.updateItemContainer(container, newIndex);
            }
        } else {
            changed = prevTopIndex - currentTopIndex;
            if (changed < this.containerCount) {
                for (i = changed - 1; i >= 0; i--) {
                    newIndex = currentTopIndex + i;
                    container = this.itemContainers.pop();
                    this.itemContainers.unshift(container);
                    this.updateItemContainer(container, newIndex);
                }
            } else {
                if (y === 0) {
                    for (i = changed - 1; i >= 0; i --) {
                        newIndex = currentTopIndex + i;
                        container = this.itemContainers.pop();
                        this.itemContainers.unshift(container);
                    }
            
                    for (var i = 0, j = this.itemContainers.length; i < j; i ++) {
                        this.updateItemContainer(this.itemContainers[i], i);	
                    }
                }	
            }
        }
        this.topItemIndex = currentTopIndex;
    }
    else if (prevTopIndex != currentTopIndex && currentTopIndex == maxTopIndex) {
        var replacementHappen = false, changed = currentTopIndex - prevTopIndex;
        for (i = 0; i < changed; i ++) {
            newIndex = prevTopIndex + containerLength + i;
            if (newIndex <= listLength - 1) {
                container = this.itemContainers.shift();
                this.itemContainers.push(container);
                this.updateItemContainer(container, newIndex);
                
                replacementHappen = true;
            }
        }
        
        if (replacementHappen) {
            this.topItemIndex = currentTopIndex - 1;
        }
    }

    if (this.options.onScroll) {
        this.options.onScroll.apply(this, [y]);
    }
};

ListView.prototype.updateItemContainer = function(container, index) {
    var me = this,
    itemData = me.dataList[index];
    container.setAttribute('data-index', index);
    if (me.options.partlyItemTemplate) {
        container.innerHTML = itemData.partlyContent;
    } else {
        container.innerHTML = itemData.content;
    }
    translate(container, itemData.translateY);
};

ListView.prototype.addData = function(data) {
    var offset = this.dataList.length;
    this.oriDataList = this.oriDataList.concat(data);
    this.formatData(offset);
    this.updateScrollerRange();
};
	
ListView.prototype.updateScrollerRange = function() {
    var maxHeight = this.dataList.length * this.itemHeight;
    this.scroller.updateMaxScroll(maxHeight);
    this.maxHeight = maxHeight;
    this.scrollTo(this.scroller.y - 1);
};

ListView.prototype.scrollTo = function(n, d) {
    this.scroller.scrollTo(n, d || 0);
};

ListView.prototype.stop =  function() {
    this.scroller.stop();
};

ListView.prototype.destroy = function() {
    this.scroller.destroy();
};

ListView.prototype.disable = function() {
    this.scroller.disable();
};

ListView.prototype.enable = function() {
    this.scroller.enable();
};

window.ListView = ListView;
}());