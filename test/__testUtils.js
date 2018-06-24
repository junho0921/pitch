window.__forReal = /realMode/.test(window.location.hash);
window.__fill = function (container, color, w, h) {
  if(window.__forReal){return;}
  var __shape = new createjs.Shape();
  __shape.graphics.clear();
  let rect = new createjs.Shape();
  //用画笔设置颜色，调用方法画矩形，矩形参数猜都猜出来了：x,y,w,h
  rect.graphics.beginFill(color).drawRect(0, 0, w, h);
  //添加到舞台
  container.addChild(rect);
};
window.__debug = function () {
  console.log.apply(this, arguments);
};
window.__error = function () {
  console.error.apply(this, arguments);
};
window.__warn = function () {
  console.warn.apply(this, arguments);
};
var $log = $('<div>', {
    css: {
      position: 'absolute',
      zIndex: 99999,
      width: '500px',
      bottom: '0',
      left: '0',
      background: 'lightBlue',
      minHeight: '0px'
    }
  }),
  cssLine = {
    fontSize: '20px',
    lineHeight: '30px',
  };
$('.livearea').append($log);
window.__log = function (idName, txt) {
  var $e = window.__log[idName];
  if(!$e){
    $e = $('<div>', {
      id: idName,
      css: cssLine
    });
    $log.append($e);
    window.__log[idName] = $e;
  }
  $e.text(idName + ' : ' + txt);
};
window.__pitchLog = {
  __N: 'NONE',
  logCurrentPitchInfo: function () {
    if(!pitchReducer.currentSong){return;}
    try {
      var
        _position = pitchReducer.getPosition(),
        result = pitchReducer.getRangItems(_position, 'testForLog'),
        currentItem = result && result[0];
      // if(result && result.length > 1){
      //   __error('数据有问题', result, _position);
      // }
      __log('_position', _position / 1000);
      var content = currentItem ? currentItem.pitch +'[' +currentItem.startTime/1000 +','+currentItem.duration+']' : this.__N;
      __log('currentPitchH', content);
    }catch (e){
      __error('logCurrentPitchInfo error', e);
    }
  },
  startTestTimer: function () {
    if(!window.__forReal && !this.timer){
      this.timer = window.setInterval(function () {
        window.__pitchLog.logCurrentPitchInfo();
      }, 1000 / 60 * 4)
    }
  },
  endTestTimer: function () {
    window.clearInterval(this.timer);
    this.timer = null;
  }
};
