fxDefine('pitchReducer', function () {
  'use strict';
  // todo 申请
  __inline('/static/room/modules/pitch/test/__testUtils.js');
  var PITCH_HEIGHT_UNIT = 1; // 刻度单位
  var PITCH_HEIGHT_TOTAL = 21 * PITCH_HEIGHT_UNIT; // 刻度总高度 = 21个单位
  /*
   * 音高线数据处理器
   * */
  var pitchReducer = {
    currentSong: null,
    PITCH_HEIGHT_TOTAL: PITCH_HEIGHT_TOTAL,  // 刻度总高度
    event: {},
    loopMemo: {},
    songData: {},
    getNow: function () {
      return Date.now();
    },
    /*
     * 重置，清理缓存
     * */
    reset: function () {
      __warn('重置所有reducer缓存');
      this.currentSong = null;
      this.songData = {};
      this.loopMemo = {};
    },
    /*
     * 方法：绑定事件
     * */
    on: function (eventName, handler, context) {
      this.event[eventName] = {
        handler: handler,
        context: context || this
      };
      return this;
    },
    /*
     * 方法：触发事件
     * */
    trigger: function (eventName, args) {
      var e = this.event[eventName];
      if (e && e.handler && e.handler.apply) {
        e.handler.apply(e.context, args);
      }
      return this;
    },
    /*
     * 方法：获取音高线高度
     * */
    getPitchPosY: function (pitch) {
      var y = 0;
      if (pitch <= 10) {
        y = PITCH_HEIGHT_TOTAL;
      } else if (pitch >= 90) {
        y = 0;
      } else if (pitch >= 10 && pitch <= 90) {
        // 10-90：以4为间隔，正好取出21个数，作为显示高度
        y = PITCH_HEIGHT_TOTAL - Math.ceil((pitch - 10) / 4) * PITCH_HEIGHT_UNIT;
      }
      return y;
    },
    /*
     * 方法：获取命中三角形高度
     * (0:无声，1:错误（比标准小），2:偏离（比标准小）,3:准确，4:偏离（比标准大），5:错误（比标准大），10-90为伴奏部分显示实时音)
     * */
    calcAccuracyPosY: function (accuracy, currentPitchPosY) {
      var posY;
      accuracy = accuracy || 0;
      if (accuracy === 0) {
        // 无声：置于底部
        posY = PITCH_HEIGHT_TOTAL;
      } else if (accuracy === 1) {
        // 以当前音高线高度：上移两个单位
        posY = currentPitchPosY - 2 * PITCH_HEIGHT_UNIT;
      } else if (accuracy === 2) {
        // 以当前音高线高度：上移一个单位
        posY = currentPitchPosY - PITCH_HEIGHT_UNIT;
      } else if (accuracy === 3) {
        // 以当前音高线高度：重合
        posY = currentPitchPosY;
      } else if (accuracy === 4) {
        // 以当前音高线高度：下移一个单位
        posY = currentPitchPosY + PITCH_HEIGHT_UNIT;
      } else if (accuracy === 5) {
        // 以当前音高线高度：下移两个单位
        posY = currentPitchPosY + 2 * PITCH_HEIGHT_UNIT;
      } else if (accuracy >= 10 && accuracy <= 90) {
        // 10-90为伴奏部分显示实时音：重新计算高度
        // 10-90：以4为间隔，正好取出21个数，作为显示高度
        var a = Math.ceil((accuracy - 10) / 4) * PITCH_HEIGHT_UNIT;
        posY = PITCH_HEIGHT_TOTAL - a;
      }
      return isNaN(posY) || posY === null ? PITCH_HEIGHT_TOTAL : posY;
    },
    getAccuracy: function () {
      var songState = this.currentSong && this.songData[this.currentSong];
      return {
        accuracy: songState && songState.accuracy || 0,
        pos: songState && songState.accuracyPos || this.getPosition()
      };
    },
    //getScore: function () {
    //  var songState = this.currentSong && this.songData[this.currentSong];
    //  var _scoreGrade = songState && songState.scoreGrade;
    //  if (_scoreGrade) {
    //    return {
    //      score: _scoreGrade,
    //      time: songState.scoreTime
    //    };
    //  }
    //  return null;
    //},
    /*
     * 方法：获取命中三角的位置高度Y
     * */
    getAccuracyPosY: function () {
      if (!this.currentSong) {
        __error('还没有歌曲');
        return;
      }
      var
        data = this.getAccuracy(),
        accuracy = data.accuracy,
        pos = this.getPosition(),
        currentPitchData = this.getRangItems(pos, 'current'),
        pitchPosY = currentPitchData && currentPitchData[0] && currentPitchData[0].lineY;
      return {
        posY: this.calcAccuracyPosY(
          accuracy,
          pitchPosY
        ),
        pitchPosY: pitchPosY,
      };
    },
    checkInside: function (targetRange, range) {
      if (typeof range === 'number') {
        range = [range, range]
      }
      var targetEndPointBeforeRange = targetRange[1] < range[0];
      var targetStartPointAfterRange = targetRange[0] > range[1];
      var outSide = targetEndPointBeforeRange || targetStartPointAfterRange;
      return !outSide;
    },
    /*
     * 方法：获取指定范围的音高线数据
     * */
    getRangItems: function (range, memoIdName) {
      var
        count = 0, // 测试
        result = [],
        runLoop = true,
        songState = this.songData[this.currentSong],
        index = songState && songState.minIndex,
        pitchList = songState && songState.pitchs,
        length = pitchList && pitchList.length;
      if (!range) {
        return [];
      }
      if (typeof range === 'number') {
        range = [range, range];
      }
      if (!songState || !pitchList) {
        return false;
      }
      var isTestLog = memoIdName === 'testForLog';
      /*
       * 修正遍历开始index值
       * */
      if (memoIdName) {
        memoIdName = this.currentSong + '' + memoIdName;
        this.loopMemo[memoIdName] = this.loopMemo[memoIdName] || songState.minIndex;
        var loopIndex = this.loopMemo[memoIdName],
          lastItem = pitchList[loopIndex];
        if (lastItem && lastItem.startTime <= range[0]) {
          index = loopIndex;
        } else {
          // 数据有问题，遍历的第一个item不在范围之前
          this.loopMemo[memoIdName] = songState.minIndex;
          if (loopIndex !== songState.minIndex) {
            __error('数据有问题，遍历的第一个item不在范围之前', songState.minIndex, lastItem, range, this.getPosition());
          }
        }
      }
      // 遍历
      for (; index < length && runLoop; index++, count++) {
        var item = pitchList[index];
        if (!item) {
          __error('缺失item - ', index);
          continue;
        }
        var
          startPointAfterRang = item.startTime > range[1],
          endPointBeforeRang = item.endTime < range[0],
          inRange = !startPointAfterRang && !endPointBeforeRang;
        if (inRange) {
          result.push(item);
        }
        // 范围之后：终止
        if (startPointAfterRang) {
          runLoop = false;
        }
      }
      // 判断：音高线数据的最后一个是范围之前
      if (result.length === 0 && pitchList[length - 1].endTime < range[0]) {
        !isTestLog && __warn('最后一个已经不满足', pitchList[length - 1], range, this.getPosition());
        return null;
      }
      if (memoIdName && result.length) {
        this.loopMemo[memoIdName] = result[0].index;
      }
      !isTestLog && count > 20 && __debug('count', count);
      return result;
    },
    getPosition: function () {
      var songState = this.songData[this.currentSong];
      if (songState) {
        return songState.position + (this.getNow() - songState.dataTime);
      }
    },
    renderSongState: function () {
      return {
        scoreGrade: null,
        accuracy: null,
        position: null,
        dataTime: null,
        minIndex: null,
        saveIndex: {},
        pitchs: []
      }
    },
    reducer: function (data) {
      // todo 测试
      window.__pitchLog && window.__pitchLog.startTestTimer();
      if (!data) {
        return __debug('有信号没有数据');
      }
      data.songid = data.songid || data.hash;
      if (!data.songid) {
        return __error('none songId');
      }
      if (!data.position) {
        return __error('没有給时间');
      }
      if (!this.songData[data.songid] && !data.position) {
        return __error('第一次存储的时候必须要position');
      }
      var
        _now = this.getNow(),
        songState = this.songData[data.songid] = this.songData[data.songid] || this.renderSongState();
      this.currentSong = data.songid;
      // 数据：评分
      if (data.scoreGrade) {
        // __error('data ---- scoreGrade', data.scoreGrade);
        songState.scoreGrade = data.scoreGrade;
        songState.scoreTime = _now;
        this.trigger('receiveScore', [{
          score: data.scoreGrade,
          time: _now
        }]);
      }
      // 数据：命中
      songState.accuracy = data.accuracy || null;
      songState.accuracyPos = data.intime || data.position;
      // 数据：位置
      songState.position = data.position - (data.offset || 0);
      songState.dataTime = _now;
      // 数据：音高线
      this.receiveList(data.pitchDoc, songState);
    },
    receiveList: function (pitchDoc, songState) {
      var isReceivePitch, pitchData = typeof pitchDoc === 'string' && pitchDoc.length && pitchDoc.split(',');
      if (!pitchData) {
        return;
      }
      // 直播伴侣的精准音高线数据在pitchDoc字段
      for (var i = 0, l = pitchData.length; i < l; i++) {
        // 过滤掉空格 trim  去掉空格
        var item = pitchData[i].trim();
        if (!item) {
          continue;
        }
        isReceivePitch = true;
        if (!songState.saveIndex[item]) {
          songState.saveIndex[item] = true;
          this.saveVO(songState, item);
        }
      }
      if (isReceivePitch) {
        this.trigger('receivePitch');
      }
    },
    saveVO: function (songState, item) {
      var
        pitchArr = item.split(" ");
      var
        pitchVo = {
          index: Number(pitchArr[0]),
          startTime: Number(pitchArr[1]),
          duration: Number(pitchArr[2]),
          endTime: Number(pitchArr[1]) + Number(pitchArr[2]),
          pitch: Number(pitchArr[3])
        },
        endTime = pitchVo.startTime + pitchVo.duration,
        timeIsCorrect = !isNaN(endTime);
      if (!timeIsCorrect) {
        __error('reducer 时间错误', endTime);
      } else {
        // 计算高度
        pitchVo.lineY = this.getPitchPosY(pitchVo.pitch);
        // 缓存
        songState.pitchs[pitchVo.index] = pitchVo;
        if (songState.minIndex === null) {
          songState.minIndex = pitchVo.index
        }
        if (pitchVo.index < songState.minIndex) {
          songState.minIndex = pitchVo.index
        }
      }
    },
    clearData: function () {
      __debug('clearData');
      // 清理缓存
      this.reset();
      // 触发结束事件
      this.trigger('end');
      // todo 测试
      window.__pitchLog && window.__pitchLog.endTestTimer();
    }
  };

  return pitchReducer;
});
