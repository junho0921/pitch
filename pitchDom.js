fxDefine('pitchDom', function () {
  'use strict';
  /*
   * 音高线的DOM操作器
   * */
  var $pitch = {
    gradeMemo: {},
    gradeIcon: {
      'SSS': 'pitchGrade_sss',
      'SS': 'pitchGrade_ss',
      'S': 'pitchGrade_s'
    },
    isShow: false, // 是否正在展示音高线DOM
    IDENTIFY_TIME: 4000, // 识别模式的保护时长
    _canBeScoreMode: false, // 是否可以进入评分模式
    container: '.lyricBox-wrap',
    render: function () {
      // 样式
      fxRequire.injectStyle(__inline('/static/room/modules/pitch/pitch.css'));
      // 模板
      $(this.container).append(__inline('/static/room/modules/pitch/pitch.tpl'));
    },
    // 进入评分模式
    intoSoreMode: function (score) {
      // 条件：有分数，可以进入评分模式，与已经显示的评分不同
      if (score && this._canBeScoreMode && score !== this._score) {
        this._score = score;
        $('#pitch_score').text(score);
        $('#pitchArea').removeClass('pitch_identifying');
      }
    },
    // 进入真唱识别模式
    intoIdentifyMode: function () {
      this._score = null;
      $pitch._canBeScoreMode = false;
      clearTimeout(this.timer);
      // 进入设别模式，必须停留4秒时间
      this.timer = setTimeout(function () {
        $pitch._canBeScoreMode = true;
      }, this.IDENTIFY_TIME);
      $('#pitchArea').addClass('pitch_identifying');
    },
    // 展示评分
    showGrade: function (scoreGrade) {
      /*可删除*/
      if (!scoreGrade) {
        return;
      }
      // 关闭识别效果，进入评分模式
      $pitch.intoSoreMode(scoreGrade.score);
      $pitch.showGradeIcon(scoreGrade);
    },
    // 展示评分icon
    showGradeIcon: function (scoreGrade) {
      // 条件：可以进入评分模式，未展示过的评分
      if (this._canBeScoreMode && !this.gradeMemo[scoreGrade.time] && __getNow() - scoreGrade.time < 1000) {
        if (this.gradeIcon[scoreGrade.score]) {
          var icon = $('<span>', {class: 'pitchGradeIcon ' + this.gradeIcon[scoreGrade.score]});
          $('#pitchArea').append(icon);
          icon.on('animationend', function () {
            icon.remove();
          });
        }
      }
      this.gradeMemo[scoreGrade.time] = true;
    },
    // 清理评分icon
    clearScoreIcon: function () {
      $('.pitchGradeIcon').remove();
    },
    // 展示音高线界面
    show: function () {
      if (this.isShow) {
        return;
      }
      this.isShow = true;
      $('#pitchArea').show();
      // 给歌词容器添加类名：让UI调整为音高线模式
      $(this.container).addClass('LyricPlay_wrap_pitch');
    },
    // 隐藏音高线界面
    hide: function () {
      this.isShow = false;
      $('#pitchArea').hide(); // 先隐藏音高线，等歌词报文type5来的时候才显示
      // 给歌词容器删除类名：让UI调整推出音高线模式
      $(this.container).removeClass('LyricPlay_wrap_pitch');
      this.clearScoreIcon();
    }
  };
  return $pitch;
});
