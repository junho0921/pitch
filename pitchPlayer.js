// 依赖模块：音高线画板
__inline('/static/room/modules/pitch/pitchCanvas.js');
// 依赖模块：DOM操作
__inline('/static/room/modules/pitch/pitchDom.js');
// 依赖模块：数据处理器
__inline('/static/room/modules/pitch/pitchReducer.js');
// 定义模块：音高线播放模块
fxDefine('pitchPlayer', function(){
  'use strict';
  // 数据处理模块
  var
    PitchCanvas = fxRequire('PitchCanvas'),
    $pitch = fxRequire('pitchDom'),
    pitchReducer = fxRequire('pitchReducer'),
    handleTickCount = 1; // 测试
  function throttleExecute(id, callback, time){
    if(typeof callback === 'function' && !throttleExecute.running[id]){
      throttleExecute.running[id] = true;
      setTimeout(function () {
        throttleExecute.running[id] = false;
      }, time);
      callback();
    }
  }
  throttleExecute.running = {};
  /*
  * 音高线播放器
  * 使用两个屏幕轮播的方式来展示动画
  * */
  var pitchPlayer = {
    /*配置*/
    TIME_IDLE: 5000, // 没有音高线的展示的情况下，最长的保留展示音高线界面的时间
    POS_MAX_GAP: 300, // 容忍间隔：若数据的播放位置与播放器的播放位置相隔的最大值
    RATE: 1000 / 100, // 10px每秒
    SPR_WITH: 240, // 画板宽度
    GUIDE_POS: 35,
    /*状态*/
    isShutDown: false, // 音高线播放器的开关
    _maxErrorCount: 3, // 容忍的错误次数，用于控制音高线功能关闭
    polling: false, // 轮询状态
    /*缓存*/
    canvas: null, // 画板
    sprList: null, // 轮播画板状态数据
    currentSongId: null, // 当前播放歌曲id
    /*
    * 初始化
    * */
    init: function () {
      if (this.isInit) {
        return;
      }
      // 依赖歌词模块
      if(!fxRequire('lyric')){
        return;
      }
      this.isInit = true;
      this.lyric = fxRequire('lyric');
      // 渲染基本DOM
      $pitch.render();
      // 初始化Canvas
      this.canvas = new PitchCanvas({
        id: 'pitchCanvas',
        SPR_WITH: this.SPR_WITH,
        RATE: this.RATE,
        ACC_HEIGHT: 10, // 命中三角的高度
        ACC_WIDTH: 5, // 命中三角的宽度
        PITCH_HEIGHT: pitchReducer.PITCH_HEIGHT_TOTAL, // 音高线的高度
        GUIDE_POS: this.GUIDE_POS // 命中三角的x坐标
      });
      // 创建画板数据缓存，数量为2，因为轮播效果需要两个画板
      this.sprList = [{id: 'spr_1'}, {id: 'spr_2'}];
      // 订阅音高线报文，type=5的数据是音高线数据的源头
      this.subscribeSignal();
      // 订阅数据处理器事件
      pitchReducer
        // 绑定事件：收到音高线数据，展示音高线动画
        .on('receivePitch', this.toShowPitch, this)
        // 绑定事件：收到评分数据，展示评分
        .on('receiveScore', this.toShowScore, this)
        // 绑定事件：结束，隐藏音高线界面
        .on('end', this.hide, this)
        // 绑定事件：音高线数据处理出错，隐藏音高线界面
        .on('error', this.hide, this);
    },
    /*
    * 方法：隐藏音高线
    * */
    hide: function (errorMsg) { // todo 上报
      if(errorMsg){
        __error('报错：', errorMsg);
        if(--this._maxErrorCount < 0){
          this.isShutDown = true;
        }
      }
      this.clearTimerToHide();
      __warn('音高线结束事件');
      // 停止 并 重置canvas配置
      this.stopPolling();
      this.reset();
      // 隐藏DOM
      $pitch.hide();
    },
    // 订阅报文
    subscribeSignal: function () {
      window.addAccurateLyricCallback('liveFlashBox', function (info) {
        if(pitchPlayer.isShutDown){
          return;
        }
        var
          songInfo = JSON.parse(info),
          data = songInfo && songInfo.data;
        if(!data) {
          return;
        }
        var
          isThisRoomSign = data.userId == window.liveInitData.starId,
          isLyricSign = songInfo.type == 10,
          isPitchSign = songInfo.type == 5;
        // 若不是本房间信号，忽略
        if(!isThisRoomSign){
          return;
        }
        // 若是歌词的关闭信号：清理音高线数据（触发音高线关闭）
        if(isLyricSign && data.state == 0){
          __debug('歌词的关闭信号：清理音高线数据（触发音高线关闭）');
          return pitchReducer.clearData();
        }else if(isPitchSign){
          if(pitchPlayer.lyric && pitchPlayer.lyric.isShow()){
            // 当type=5而且，报文包含有属性pitchCount，表示这是音高线的报文 （直播伴侣每隔500ms就会发送音高线报文）
            if(data.hasOwnProperty('pitchCount')) {
              // 接收信息并加工处理
              pitchReducer.reducer(data);
            }
          }else if($pitch.isShow){
            __debug('收到音高线报文，但歌词不显示，所以关闭音高线');
            // 清理音高线数据（触发音高线关闭）
            pitchReducer.clearData();
          }
        }
      });
    },
    /*
    * 触发音高线展示
    * 1，若没有展示DOM，就显示DOM
    * 2，若没有启动动画轮询，就启动轮询
    * */
    toShowPitch: function () {
      if(this.isShutDown){
        return;
      }
      window.show_ssss && __debug('收到音高线报文');
      this.clearTimerToHide();
      // 展示DOM
      $pitch.show();
      // 启动播放器
      this.startPlay();
    },
    startPlay: function () {
      // 判断播放器轮询状态，是则返回，否就启动轮询
      if(this.polling){
        return;
      }
      // 获取当前的音高线播放进度
      var currentPlayPos = pitchReducer.getPosition();
      if(!currentPlayPos){return;}
      __debug('startPlay');
      // 重置
      this.reset(currentPlayPos);
      // DOM显示识别模式
      $pitch.intoIdentifyMode();
      // 启动轮询
      this.startPolling();
    },
    startPolling: function () {
      if(this.polling){
        return;
      }
      createjs.Ticker.addEventListener('tick', this.handleTick);
      createjs.Ticker.addEventListener("tick", this.canvas.stage);
      this.polling = true;
      return this;
    },
    stopPolling: function () {
      createjs.Ticker.removeEventListener("tick", this.canvas.stage);
      createjs.Ticker.removeEventListener('tick', this.handleTick);
      this.polling = false;
      return this;
    },
    reset: function (currentPlayPos, now) {
      currentPlayPos = currentPlayPos || pitchPlayer.getPlayerPosition();
      // 记录重置时刻的播放进度
      this._initSprPlayPos = currentPlayPos;
      // 记录重置时刻的时间点
      this._initSprTime = currentPlayPos && (now || pitchReducer.getNow());
      // 清理缓存
      this.sprList.forEach(function (spr) {
        spr.__sprIndex = null;
        spr.range = null;
        spr.lsItems = undefined;
      });
      this.currentSongId = null;
      this.tickTime = null;
      // 画板清理与重置
      this.canvas.clear();
    },
    toShowScore: function (data) {
      if($pitch.isShow){
        // 渲染：评分等级
        $pitch.showGrade(data);
      }
    },
    /*
    * 获取播放器的当前播放进度
    * 区别于pitchReducer的方法getPosition播放进度，这是浏览器实际的动画执行的播放进度时间。
    * */
    getPlayerPosition: function (now) {
      now = now || pitchReducer.getNow();
      return now - this._initSprTime + this._initSprPlayPos;
    },
    /*
    * 每帧执行的逻辑
    * */
    handleTick: function () {
      if(!pitchPlayer.polling){
        __error('停止轮询了');
        return;
      }
      !window.__forReal && __log('handleTickCount', handleTickCount++);
      var
        _this = pitchPlayer,
        now = pitchReducer.getNow(),
        position_data = pitchReducer.getPosition(),
        // 判断：是否已经换歌
        changeSong = _this.currentSongId && pitchReducer.currentSong !== _this.currentSongId,
        // 判断：本次执行与上次执行的时间差距过长
        tickHandlerLoopLong = _this.tickTime && (now - _this.tickTime) > 1000;
      if(!position_data){
        return _this.hide({code: 1, desc:[pitchReducer.currentSong]});
      }
      window.__logTickTime && __debug('tick gap', now - _this.tickTime);
      if(changeSong){
        // 若换歌，重置画板
        __warn('changeSong', changeSong, pitchReducer.currentSong);
        _this.reset(position_data, now);
        // DOM显示识别模式
        $pitch.intoIdentifyMode();
      }else if(tickHandlerLoopLong){
        // 对比本次执行与上次执行的时间差距，若大于1秒，重置渲染画板，让动画更准确
        __warn('渲染间隔大', now - _this.tickTime);
        _this.reset(position_data, now);
      }else{
        var
          position_player = _this.getPlayerPosition(now),
          gap = position_data - position_player,
          positionIsNotFine = Math.abs(gap) > _this.POS_MAX_GAP;
        // 若数据的播放位置与播放器的播放位置相隔太大，重置画板
        if(positionIsNotFine){
          __warn('gap超过', gap);
          _this.reset(position_data, now);
        }
      }
      // 记录执行的时间点
      _this.tickTime = now;
      // 记录当前渲染的歌曲id
      _this.currentSongId = pitchReducer.currentSong;
      // 音高线屏幕轮播与渲染
      _this.adjustSprPos(now);
      // 音高命中的碰撞线与指针位置
      _this.accuracyAnimate();
    },
    // 音高线屏幕轮播与渲染
    adjustSprPos: function (now) {
      now = now || pitchReducer.getNow();
      var
        // 轮播器的总运行时间
        _gap = now - this._initSprTime,
        // 计算轮播到第几个画板
        currentSprCount = Math.floor(_gap / (this.SPR_WITH * this.RATE)),
        nextSprCount = currentSprCount + 1,
        sprLen = this.sprList.length,
        currentSpr = this.sprList[currentSprCount % sprLen],
        nextSpr = this.sprList[nextSprCount % sprLen],
        // 一个屏幕的播放时长
        SprPlayLen = this.SPR_WITH * this.RATE;
      // __debug('sprLen', sprLen, currentSpr, nextSpr);
      // 当前画板的位置
      if(isNaN(currentSprCount) || !currentSpr || !nextSpr){
        return this.hide({code: 2, desc: [this._initSprTime, currentSprCount, currentSpr, nextSpr]});
      }
      currentSpr.x = - (_gap / this.RATE - currentSprCount * this.SPR_WITH);
      // 渲染位置
      this.canvas.setSprPos(currentSpr);
      if(!currentSpr.range || currentSprCount !== currentSpr.__sprIndex){
        currentSpr.__sprIndex = currentSprCount;
        // 标记画板的播放范围
        var currentSprRange_start = this._initSprPlayPos + currentSprCount * this.SPR_WITH * this.RATE - this.GUIDE_POS * this.RATE;
        currentSpr.range = [currentSprRange_start, currentSprRange_start + SprPlayLen];
        // 获取画本范围内的音高线items
        currentSpr.lsItems = pitchReducer.getRangItems(currentSpr.range, 'SPR');
        // 渲染音高线
        this.canvas.drawSpr(currentSpr);
      }
      // 下一个画板位置
      nextSpr.x = currentSpr.x + this.SPR_WITH;
      // 渲染位置
      this.canvas.setSprPos(nextSpr);
      if(nextSprCount !== nextSpr.__sprIndex){
        nextSpr.__sprIndex = nextSprCount;
        // 标记画板的播放范围
        var nextSprRange_start = currentSpr.range[1];
        nextSpr.range = [nextSprRange_start, nextSprRange_start + SprPlayLen];
        // 获取画本范围内的音高线items
        nextSpr.lsItems = pitchReducer.getRangItems(nextSpr.range, 'SPR');
        // 渲染音高线
        this.canvas.drawSpr(nextSpr);
      }
      // 若两个屏幕都没有items的话，停止
      if(currentSpr.lsItems === null && nextSpr.lsItems === null){
        this.stop();
        // 没有音高线的展示的情况下，延时5秒来隐藏音高线界面
        this.setTimerToHide();
      }
    },
    // 设置定时器来在指定时间来隐藏音高线
    setTimerToHide: function () {
      var _this = this;
      this.clearTimerToHide();
      this.timerToHide = window.setTimeout(function () {
        _this.hide();
      }, this.TIME_IDLE);
    },
    clearTimerToHide: function () {
      if(this.timerToHide){
        window.clearTimeout(this.timerToHide);
        this.timerToHide = null;
      }
    },
    /*
    * 停止
    * */
    stop: function () {
      __debug('pitchPlayer stop');
      this.canvas.clear();
      this.stopPolling();
    },
    // 音高命中的碰撞线与指针位置
    accuracyAnimate: function () {
      if(!this.currentSongId){
        return;
      }
      var accuracyPosY = pitchReducer.getAccuracyPosY();
      // 设置命中三角形位置
      this.canvas.setCurrentAcc(accuracyPosY.posY);
      // 碰撞线
      if(!isNaN(accuracyPosY.pitchPosY)){
        this.drawCollisionLine(accuracyPosY.posY);
      }
    },
    // 渲染命中的碰撞线与碰撞星星
    drawCollisionLine: function (accuracyPosY) {
      // 没有音高线就不需要渲染碰撞线
      if(accuracyPosY === null){
        return;
      }
      // 命中音高线条件： 等于3, >10&&<90; 只有命中的时候才描绘碰撞点
      if(pitchReducer.getAccuracy().accuracy !== 3){
        return;
      }
      var
        _this = this,
        currentPos = pitchReducer.getPosition(),
        currentSpr = pitchReducer.checkInside(this.sprList[0].range, currentPos) && this.sprList[0];
      currentSpr = currentSpr || pitchReducer.checkInside(this.sprList[1].range, currentPos) && this.sprList[1];
      // 没有获取到屏幕，报错，隐藏
      if(!currentSpr){
        return this.hide({code: 3, desc: [this.sprList, currentPos]});
      }
      // 获取当前命中的高度
      if(isNaN(accuracyPosY)){
        accuracyPosY = pitchReducer.PITCH_HEIGHT_TOTAL;
      }
      // 渲染：碰撞线
      this.canvas.drawCollisionLine(accuracyPosY, currentPos, currentSpr);
      // 渲染：碰撞星星
      throttleExecute('star', function () {
        _this.canvas.renderStars();
      }, 200);
    }
  };

  return pitchPlayer;
});
