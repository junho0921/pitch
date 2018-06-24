__inline('/static/room/modules/pitch/lab/easeljs.js');
__inline('/static/room/modules/pitch/lab/tweenjs.js');
// 音高线入口文件
fxDefine('PitchCanvas', function () {
  'use strict';
  var PR = window.devicePixelRatio || 1;
  var PITCH_LINE_HEIGHT = 2; // 应高线的厚度
  var CANVAS_PADDING_TOP = 16;
  var CANVAS_PADDING_LEFT = 0;
  var spriteArray = [
    new createjs.Bitmap(__uri("/static/room/modules/pitch/image/score-Rstar.png")),
    new createjs.Bitmap(__uri("/static/room/modules/pitch/image/score-Ystar.png"))
  ];
  function randomNumber() {
    return 2*(0.5 - Math.random().toFixed(2))
  }
  function randSprite() {
    var spriteBitMap = spriteArray[(randSprite.index++) % spriteArray.length];
    if(!spriteBitMap){
      return;
    }
    spriteBitMap = spriteBitMap.clone();
    spriteBitMap.scale = 0.25 * PR;
    // 飞向位置
    spriteBitMap.toPosX = randomNumber() * 8;
    spriteBitMap.toPosY = randomNumber() * 8 - CANVAS_PADDING_TOP;
    return spriteBitMap;
  }
  randSprite.index = 0;
  /*
  * 音高线画板
  * @desc 纯渲染工具，不涉及计算
  * */
  function PitchCanvas(config) {
    // 初始化参数
    this.config = $.extend({}, config);
    this.canvasHeight = this.config.PITCH_HEIGHT + this.config.ACC_HEIGHT + CANVAS_PADDING_TOP + PITCH_LINE_HEIGHT;
    this._sprList = {};
    // 创建总canvas
    var canvas = document.getElementById(config.id);
    if(!canvas){
      return;
    }
    this.stage = new createjs.Stage(canvas);
    this.stage.y = CANVAS_PADDING_TOP * PR;
    this.stage.x = 0;
    this.stage.canvas.width = this.config.SPR_WITH * PR;
    this.stage.canvas.height = this.canvasHeight * PR;
    // 设置画板样式的尺寸
    $('#'+config.id).css({
      width: this.config.SPR_WITH,
      height: this.canvasHeight,
      top: -CANVAS_PADDING_TOP
    });
    // 配置动画的帧控制
    this.configStage();
  }

  PitchCanvas.prototype = {
    _sprList: null, // 画板缓存
    framerate: 30, // 每秒播放的帧数
    // 获取画板方法
    _getSpr: function (id) {
      if(!id){
        return;
      }
      if(!this._sprList[id]){
        var spr = new createjs.Container();
        spr.y = (this.config.ACC_HEIGHT / 2 + PITCH_LINE_HEIGHT / 2) * PR;
        this.stage.addChild(spr);
        this._sprList[id] = spr;
      }
      return this._sprList[id];
    },
    // 设置画板位置
    setSprPos: function (data) {
      if(!data || !data.id){
        return;
      }
      var spr = this._getSpr(data.id);
      // 获取画板，设置画板位置
      if(spr){
        spr.x = (data.x + CANVAS_PADDING_LEFT) * PR;
      }
    },
    configStage: function () {
      createjs.Ticker.framerate = this.framerate;
      // createjs.Ticker.timingMode = createjs.Ticker.RAF_SYNCHED;
      createjs.Ticker.timingMode = createjs.Ticker.RAF;
    },
    /*
    * 方法：清理画板
    * */
    clear: function () {
      __debug('canvas 清理与重置');
      this.clearPitchSpr();
      // 命中三角的位置
      if(this._triangle){
        this._triangle.y = this.config.PITCH_HEIGHT * PR;
      }
      // 清理星星
      this.clearStars();
      // 渲染
      this.stage.update();
    },
    clearPitchSpr: function () {
      var sprList = this._sprList;
      Object.keys(sprList).forEach(function (key) {
        sprList[key].removeAllChildren();
      });
    },
    /*
    * 方法：清理星星
    * */
    clearStars: function () {
      if(this.aniContainer){
        this.aniContainer.removeAllChildren();
      }
    },
    /**
     * @function 生成星星动画
     **/
    renderStars: function () {
      if(!this._triangle){
        return;
      }
      var
        _this = this,
        // 创建星星
        spriteBitMap = randSprite();
      if(!spriteBitMap){
        return;
      }
      // 星星的初始位置是指针位置
      spriteBitMap.x = this._triangle.x - this.config.ACC_WIDTH / 2 * PR;
      spriteBitMap.y += this._triangle.y;
      // 获取星星动画的容器
      if(!this.aniContainer){
        this.aniContainer = new createjs.Container();
        this.stage.addChild(this.aniContainer);
        this.aniContainer.x = CANVAS_PADDING_LEFT * PR;
        this.aniContainer.y = 0;
      }
      this.aniContainer.addChild(spriteBitMap);
      // 制作动画：星星由初始位置位移到左上角
      return createjs.Tween.get(spriteBitMap)
        .to({
          x: spriteBitMap.toPosX*PR,
          y: spriteBitMap.toPosY*PR,
          visible: false
        }, 400, createjs.Ease.linear)
        // 清理
        .call(function () {
          spriteBitMap = null;
          _this.aniContainer.removeChild(spriteBitMap);
        });
    },
    /*
    * 渲染音高线
    * */
    drawItems: function (container, items, fixPre) {
      var RATE = this.config.RATE;
      fixPre = fixPre || 0;
      items.forEach(function (item) {
        var
          realX = (item.startTime - fixPre) / RATE * PR,
          shape = new createjs.Shape();
        // __debug('aas渲染新的线', realX);
        shape.graphics.clear();
        shape.graphics.beginStroke(window.__forReal? '#d8d8d8':'#000');
        shape.graphics.setStrokeStyle(PITCH_LINE_HEIGHT * PR);
        shape.graphics.moveTo(0, item.lineY * PR);
        shape.graphics.lineTo(item.duration / RATE * PR, item.lineY * PR);
        shape.x = realX;
        container.addChild(shape);
      });
    },
    setCurrentAcc: function (accuracyPosY) {
      if(!this._triangle){
        // 创建三角形
        this._triangle = new createjs.Shape();
        this._triangle.graphics
          .beginFill("#FF6666")
          .moveTo(0, 0)
          .lineTo(this.config.ACC_WIDTH * PR, this.config.ACC_HEIGHT / 2 * PR)
          .lineTo(0, this.config.ACC_HEIGHT * PR)
          .closePath();
        this._triangle.x = (this.config.GUIDE_POS - this.config.ACC_WIDTH) * PR;
        this.stage.addChild(this._triangle);
      }
      if(isNaN(accuracyPosY)){
        accuracyPosY = this.config.PITCH_HEIGHT;
      }
      this._triangle.y = accuracyPosY * PR;
    },
    // 渲染分割线
    drawAccLine: function () {
       var
         lineW = 1,
         shape = new createjs.Shape();
       shape.graphics.clear();
       shape.graphics.beginStroke('#f1f1f1');
       shape.graphics.setStrokeStyle(lineW * PR);
       shape.graphics.moveTo(0, 0);
       shape.graphics.lineTo(0, this.canvasHeight * PR);
       shape.y = 0;
       shape.x = (this.config.GUIDE_POS + lineW) * PR;
       this.stage.addChild(shape);
    },
    drawSpr: function (data) {
      if(!data || !data.id){
        return;
      }
      var
        spr = this._getSpr(data.id),
        range = data.range,
        items = data.lsItems;
      // 清理画板
      spr.removeAllChildren();

      // __warn('drawContainer: ', data.__sprIndex, data.range);
      __fill(spr, data.id === 11? 'lightblue': '#D7E4FF', this.config.SPR_WITH*PR, 100); // todo 如何放入测试代码，不通过这个背景色，应该通过其他识别
      !window.__forReal && __log('__SPR__range__', range[0]/1000+','+ range[1]/1000);

      if(items && items.length){
        // __debug('渲染----', items, data);
        this.drawItems(spr, items, range[0]);
      }else{
        __debug('没有线渲染', range);
      }
    },
    drawCollisionLine: function (accuracyPosY, currentPos, data) {
      // __debug('-2-渲染命中--', currentPos);
      // 创建碰撞点
      var
        spr = this._getSpr(data.id),
        yItem = new createjs.Shape();
      yItem.graphics.clear();
      yItem.graphics.beginStroke('#FF6666');
      yItem.graphics.setStrokeStyle(PITCH_LINE_HEIGHT * PR);
      yItem.graphics.moveTo(-6 * PR, accuracyPosY * PR);
      yItem.graphics.lineTo(0, accuracyPosY * PR);
      yItem.x = (currentPos - data.range[0]) / 10 * PR;
      spr.addChild(yItem);
    }
  };
  return PitchCanvas;
});
