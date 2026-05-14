// ==========================================
// 体育館予約管理 - GAS API メイン処理
// ==========================================

var SPREADSHEET_ID = '1tUmnLtQGJVNdaQ0mGaQku8KEwuhmDF-z7lU48sSlKjo';
var SS = SpreadsheetApp.openById(SPREADSHEET_ID);

// 施設名（列C〜I = インデックス2〜8）
var FACILITY_NAMES = [
  '第1体育館 半面A',   // C列 (idx 2)
  '第1体育館 半面B',   // D列 (idx 3)
  '第1体育館（全面）', // E列 (idx 4)
  '第1体育館 ステージ', // F列 (idx 5)
  '第2体育館（全面）', // G列 (idx 6)
  '総合体育館 半面A',  // H列 (idx 7)
  '総合体育館 半面B',  // I列 (idx 8)
];

// 設定シートの行番号（debugSheetRowsで実測済み）
var SCHEDULE_ROWS = {
  weekday:            { start: 5,   end: 9   }, // 月〜金（行5-9）
  summerSatRotation:  { start: 13,  count: 9  }, // 夏季土曜 3パターン×3スロット（行13-21）
  summerSunRotation:  { start: 25,  count: 9  }, // 夏季日曜 3パターン×3スロット（行25-33）
  winterSatRotation:  { start: 37,  count: 9  }, // 冬季土曜 6パターン×3スロット（行37-54）
  winterSunRotation:  { start: 58,  count: 9  }, // 冬季日曜 6パターン×3スロット（行58-75）
  summerVacRotation:  { start: 80,  count: 9  }, // 夏季休暇 3パターン×3スロット（行80-88）
  winterVacRotation:  { start: 92,  count: 9  }, // 冬季休暇 3パターン×3スロット（行92-100）
  clubs:              { start: 104, count: 10  }, // クラブ一覧（行104-113）
  holidays:           { start: 117, end: 134  }, // 祝日データ（行117-134）
  schoolEvents:       { start: 139, end: 280  }, // 学校行事データ（行139-280）
};

// CORS対応レスポンス
function createResponse(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function doGet(e) {
  try {
    var action = e.parameter.action;
    switch (action) {
      case 'getConfig':
        return createResponse(getConfig());
      case 'getReservations':
        return createResponse(getReservations(e.parameter.year, e.parameter.month));
      case 'getLogs':
        return createResponse(getLogs(e.parameter.year, e.parameter.month));
      case 'getPushStats':
        return createResponse(getPushStats());
      default:
        return createResponse({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return createResponse({ error: err.message });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    switch (action) {
      case 'addReservation':
        return createResponse(addReservation(body));
      case 'updateReservation':
        return createResponse(updateReservation(body));
      case 'updateStatus':
        return createResponse(updateStatus(body));
      case 'deleteReservation':
        return createResponse(deleteReservation(body));
      case 'saveConfig':
        return createResponse(saveConfig(body.config));
      case 'saveRotation':
        return createResponse(saveRotation(body));
      case 'registerPush':
        return createResponse(registerPush(body));
      case 'sendNotification':
        return createResponse(sendNotification(body.title, body.body));
      default:
        return createResponse({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return createResponse({ error: err.message });
  }
}

// ==========================================
// getConfig: 全設定データ取得
// ==========================================
function getConfig() {
  var sheet = SS.getSheetByName('設定');
  if (!sheet) return { clubs: [], holidays: [], schoolEvents: [], adminPin: '1234',
    weekdaySchedule: null, saturdayRotation: null, sundayRotation: null,
    summerVacationRotation: null, winterVacationRotation: null,
    winterSaturdayRotation: null, winterSundayRotation: null };

  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(sheet.getLastColumn(), 9);
  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();

  // ---- クラブ一覧 ----
  var clubs = [];
  var clubsEnd = SCHEDULE_ROWS.clubs.end || (SCHEDULE_ROWS.clubs.start + SCHEDULE_ROWS.clubs.count - 1);
  for (var r = SCHEDULE_ROWS.clubs.start; r <= Math.min(clubsEnd, lastRow); r++) {
    var name = String(data[r - 1][0]).trim();
    if (name) clubs.push({ id: String(r), name: name });
  }

  // ---- 祝日 ----
  var holidays = [];
  for (var r = SCHEDULE_ROWS.holidays.start; r <= Math.min(SCHEDULE_ROWS.holidays.end, lastRow); r++) {
    var d = data[r - 1][0], n = String(data[r - 1][1]).trim();
    if (d && n) holidays.push({ date: formatDate_(d), name: n });
  }

  // ---- 学校行事（A=日付, B=行事名, C=種別） ----
  var schoolEvents = [];
  for (var r = SCHEDULE_ROWS.schoolEvents.start; r <= Math.min(SCHEDULE_ROWS.schoolEvents.end, lastRow); r++) {
    var d = data[r - 1][0], n = String(data[r - 1][1]).trim();
    var t = data[r - 1][2] ? String(data[r - 1][2]).trim() : '';
    if (d && n) schoolEvents.push({ date: formatDate_(d), name: n, type: (t === 'rotation' ? 'rotation' : 'weekday') });
  }

  // ---- 管理者PIN（ラベルスキャン：行番号固定不要） ----
  var adminPin = '1234';
  for (var r = 0; r < data.length - 1; r++) {
    if (String(data[r][0]).trim() === '管理者PIN') {
      var pin = String(data[r + 1][0]).trim();
      if (pin) { adminPin = pin; break; }
    }
  }

  // ---- 平日固定スケジュール ----
  var weekdaySchedule = readWeekdaySchedule_(data);

  // ---- ローテーション（夏季・冬季・休暇） ----
  var summerSatPats = readRotationPatterns_(data, SCHEDULE_ROWS.summerSatRotation.start, 3);
  var summerSunPats = readRotationPatterns_(data, SCHEDULE_ROWS.summerSunRotation.start, 3);
  var winterSatPats = readRotationPatterns_(data, SCHEDULE_ROWS.winterSatRotation.start, 6);
  var winterSunPats = readRotationPatterns_(data, SCHEDULE_ROWS.winterSunRotation.start, 6);
  var summerVacPats = readRotationPatterns_(data, SCHEDULE_ROWS.summerVacRotation.start, 3);
  var winterVacPats = readRotationPatterns_(data, SCHEDULE_ROWS.winterVacRotation.start, 3);

  // ローテーション開始番号（A列にラベルがある行を探す）
  var satStart = 0, sunStart = 0, sumVacStart = 0, winSatStart = 0, winSunStart = 0, winVacStart = 0;
  for (var r = 1; r <= Math.min(12, lastRow); r++) {
    var lbl = String(data[r - 1][0]).trim();
    var v   = parseInt(data[r - 1][1]);
    var n   = (!isNaN(v) && v >= 1) ? v - 1 : -1;
    if (lbl === '土曜開始番号'     || lbl === '土曜ローテーション開始')    { if (n >= 0) satStart    = n; }
    if (lbl === '日曜開始番号'     || lbl === '日曜ローテーション開始')    { if (n >= 0) sunStart    = n; }
    if (lbl === '夏季休暇開始番号' || lbl === '夏季休暇ローテーション開始') { if (n >= 0) sumVacStart = n; }
    if (lbl === '冬季土曜開始番号' || lbl === '冬季土曜ローテーション開始') { if (n >= 0) winSatStart = n; }
    if (lbl === '冬季日曜開始番号' || lbl === '冬季日曜ローテーション開始') { if (n >= 0) winSunStart = n; }
    if (lbl === '冬季休暇開始番号' || lbl === '冬季休暇ローテーション開始') { if (n >= 0) winVacStart = n; }
  }

  return {
    clubs:           clubs,
    holidays:        holidays,
    schoolEvents:    schoolEvents,
    adminPin:        adminPin,
    weekdaySchedule: weekdaySchedule,
    saturdayRotation: {
      summerPatterns: summerSatPats,
      winterPatterns: winterSatPats,
      startIndex:     satStart,
    },
    sundayRotation: {
      summerPatterns: summerSunPats,
      winterPatterns: winterSunPats,
      startIndex:     sunStart,
    },
    summerVacationRotation: {
      patterns:   summerVacPats,
      startIndex: sumVacStart,
    },
    winterVacationRotation: {
      patterns:   winterVacPats,
      startIndex: winVacStart,
    },
    winterSaturdayRotation: {
      patterns:   winterSatPats,
      startIndex: winSatStart,
    },
    winterSundayRotation: {
      patterns:   winterSunPats,
      startIndex: winSunStart,
    },
    rotationStartNumbers: {
      saturday:       satStart    + 1,
      sunday:         sunStart    + 1,
      summerVacation: sumVacStart + 1,
      winterSaturday: winSatStart + 1,
      winterSunday:   winSunStart + 1,
      winterVacation: winVacStart + 1,
    },
  };
}

// ==========================================
// スケジュール読み取りユーティリティ
// ==========================================

// 1行分のスロットデータを読む（B列=時間帯、C〜I列=施設ごとのクラブ名）
function readSlotRow_(data, rowNum) {
  var row = data[rowNum - 1];
  var timeSlot = String(row[1]).trim();
  if (!timeSlot || timeSlot === '時間帯') return null;
  var slots = [];
  for (var c = 2; c <= 8; c++) {
    var clubName = String(row[c]).trim();
    if (clubName) {
      slots.push({
        timeSlot:  timeSlot,
        facility:  FACILITY_NAMES[c - 2],
        clubName:  clubName,
      });
    }
  }
  return { timeSlot: timeSlot, slots: slots };
}

// 平日スケジュール（行5〜9：月〜金）
function readWeekdaySchedule_(data) {
  var dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  var schedule = {};
  for (var i = 0; i < 5; i++) {
    var rowNum = SCHEDULE_ROWS.weekday.start + i;
    var result = readSlotRow_(data, rowNum);
    schedule[dayKeys[i]] = result ? result.slots : [];
  }
  return schedule;
}

// ローテーションパターン読み取り（patternCount パターン × 3スロット）
function readRotationPatterns_(data, startRow, patternCount) {
  var patterns = [];
  for (var p = 0; p < patternCount; p++) {
    var pattern = [];
    for (var s = 0; s < 3; s++) {
      var rowNum = startRow + p * 3 + s;
      var result = readSlotRow_(data, rowNum);
      if (result && result.slots.length > 0) {
        pattern = pattern.concat(result.slots);
      }
    }
    // 空パターンでもインデックスを保持（スキップしない）
    patterns.push(pattern);
  }
  return patterns;
}

// ==========================================
// getReservations: 予約申請一覧取得
// ==========================================
function getReservations(year, month) {
  var sheet = SS.getSheetByName('予約申請');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var reservations = [];
  var y = parseInt(year), m = parseInt(month);
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;
    var status = String(row[8]);
    if (status === '削除済み') continue;  // 削除済みは除外
    var date = formatDate_(row[3]);
    var parts = date.split('-');
    if (parseInt(parts[0]) !== y || parseInt(parts[1]) !== m) continue;
    reservations.push({
      id:        String(row[0]),
      createdAt: formatDateTime_(row[1]),
      clubName:  String(row[2]),
      date:      date,
      timeSlot:  String(row[4]),
      facility:  String(row[5]),
      content:   String(row[6]),
      comment:   String(row[7] || ''),
      status:    status,
      adminMemo: String(row[9] || ''),
      updatedAt: formatDateTime_(row[10]),
      entryType: String(row[11] || 'reservation'),  // L列: エントリータイプ
    });
  }
  return reservations;
}

// ==========================================
// addReservation
// ==========================================
function addReservation(body) {
  var sheet = SS.getSheetByName('予約申請');
  if (!sheet) {
    sheet = SS.insertSheet('予約申請');
    sheet.appendRow(['申請ID','申請日時','クラブ名','対象日','時間帯','占有施設','占有内容','コメント','ステータス','管理者メモ','最終更新日時','エントリータイプ']);
  }
  var id = Utilities.getUuid();
  var now = new Date();
  var entryType = body.entryType || 'reservation';
  var status = (entryType === 'schedule' || entryType === 'deleted_slot') ? '確定' : '申請中';
  sheet.appendRow([id, now, body.clubName, new Date(body.date), body.timeSlot,
    body.facility, body.content, body.comment || '', status, '', now, entryType]);
  writeLog_('addReservation', body.clubName, entryType + '：' + body.date + ' ' + body.facility);
  return { success: true, id: id };
}

// ==========================================
// deleteReservation: スケジュールエントリ削除（論理削除）
// ==========================================
function deleteReservation(body) {
  var sheet = SS.getSheetByName('予約申請');
  if (!sheet) return { success: false, error: 'シートが見つかりません' };
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(body.id)) continue;
    var row = i + 1;
    sheet.getRange(row, 9).setValue('削除済み');
    sheet.getRange(row, 11).setValue(new Date());
    writeLog_('deleteReservation', String(data[i][2]), '削除：' + body.id);
    return { success: true };
  }
  return { success: false, error: '該当IDが見つかりません' };
}

// ==========================================
// updateReservation
// ==========================================
function updateReservation(body) {
  var sheet = SS.getSheetByName('予約申請');
  if (!sheet) return { success: false, error: 'シートが見つかりません' };
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(body.id)) continue;
    var row = i + 1;
    if (body.date)               sheet.getRange(row, 4).setValue(new Date(body.date));
    if (body.timeSlot)           sheet.getRange(row, 5).setValue(body.timeSlot);
    if (body.facility)           sheet.getRange(row, 6).setValue(body.facility);
    if (body.content)            sheet.getRange(row, 7).setValue(body.content);
    if (body.comment !== undefined) sheet.getRange(row, 8).setValue(body.comment);
    if (body.status)             sheet.getRange(row, 9).setValue(body.status);
    sheet.getRange(row, 11).setValue(new Date());
    writeLog_('updateReservation', data[i][2], '予約更新：' + body.id);
    return { success: true };
  }
  return { success: false, error: '該当IDが見つかりません' };
}

// ==========================================
// updateStatus
// ==========================================
function updateStatus(body) {
  var sheet = SS.getSheetByName('予約申請');
  if (!sheet) return { success: false };
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) !== String(body.id)) continue;
    var row = i + 1;
    sheet.getRange(row, 9).setValue(body.status);
    if (body.adminMemo !== undefined) sheet.getRange(row, 10).setValue(body.adminMemo);
    sheet.getRange(row, 11).setValue(new Date());
    writeLog_('updateStatus', '管理者', 'ステータス変更：' + body.id + ' → ' + body.status);
    return { success: true };
  }
  return { success: false };
}

// ==========================================
// getLogs
// ==========================================
function getLogs(year, month) {
  var sheet = SS.getSheetByName('ログ');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var logs = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    logs.push({
      timestamp: formatDateTime_(data[i][0]),
      action:    String(data[i][1]),
      actor:     String(data[i][2]),
      detail:    String(data[i][3]),
    });
  }
  return logs.reverse().slice(0, 200);
}

// ==========================================
// saveConfig: 設定シートへの書き込み
// ==========================================
function saveConfig(config) {
  var sheet = SS.getSheetByName('設定');
  if (!sheet) return { success: false, error: '設定シートが見つかりません' };

  // クラブ一覧
  var clubRange = SCHEDULE_ROWS.clubs.count || (SCHEDULE_ROWS.clubs.end - SCHEDULE_ROWS.clubs.start + 1);
  sheet.getRange(SCHEDULE_ROWS.clubs.start, 1, clubRange, 1).clearContent();
  (config.clubs || []).forEach(function(c, i) {
    if (i < clubRange) sheet.getRange(SCHEDULE_ROWS.clubs.start + i, 1).setValue(c.name);
  });

  // 祝日
  var holRange = SCHEDULE_ROWS.holidays.end - SCHEDULE_ROWS.holidays.start + 1;
  sheet.getRange(SCHEDULE_ROWS.holidays.start, 1, holRange, 2).clearContent();
  (config.holidays || []).forEach(function(h, i) {
    if (i < holRange) {
      sheet.getRange(SCHEDULE_ROWS.holidays.start + i, 1).setValue(new Date(h.date));
      sheet.getRange(SCHEDULE_ROWS.holidays.start + i, 2).setValue(h.name);
    }
  });

  // 学校行事（A=日付, B=行事名, C=種別）
  var evRange = SCHEDULE_ROWS.schoolEvents.end - SCHEDULE_ROWS.schoolEvents.start + 1;
  sheet.getRange(SCHEDULE_ROWS.schoolEvents.start, 1, evRange, 3).clearContent();
  (config.schoolEvents || []).forEach(function(e, i) {
    if (i < evRange) {
      sheet.getRange(SCHEDULE_ROWS.schoolEvents.start + i, 1).setValue(new Date(e.date));
      sheet.getRange(SCHEDULE_ROWS.schoolEvents.start + i, 2).setValue(e.name);
      sheet.getRange(SCHEDULE_ROWS.schoolEvents.start + i, 3).setValue(e.type || 'weekday');
    }
  });

  // 平日スケジュール
  if (config.weekdaySchedule) {
    var dayKeys = ['monday','tuesday','wednesday','thursday','friday'];
    dayKeys.forEach(function(key, i) {
      var rowNum = SCHEDULE_ROWS.weekday.start + i;
      sheet.getRange(rowNum, 2, 1, 8).clearContent();
      var slots = config.weekdaySchedule[key] || [];
      sheet.getRange(rowNum, 2).setValue('16:00〜18:00');
      slots.forEach(function(slot) {
        var idx = FACILITY_NAMES.indexOf(slot.facility);
        if (idx >= 0) sheet.getRange(rowNum, 3 + idx).setValue(slot.clubName);
      });
    });
  }

  // ローテーション書き込みユーティリティ
  function writeRotation(patterns, startRow, count) {
    for (var p = 0; p < count; p++) {
      var pat = patterns[p] || [];
      for (var s = 0; s < 3; s++) {
        var rowNum = startRow + p * 3 + s;
        var timeSlot = ['8:00〜11:00','11:00〜14:00','14:00〜17:00'][s];
        sheet.getRange(rowNum, 2, 1, 8).clearContent();
        sheet.getRange(rowNum, 2).setValue(timeSlot);
        pat.filter(function(sl) { return sl.timeSlot === timeSlot; }).forEach(function(sl) {
          var idx = FACILITY_NAMES.indexOf(sl.facility);
          if (idx >= 0) sheet.getRange(rowNum, 3 + idx).setValue(sl.clubName);
        });
      }
    }
  }

  // データが存在するパターンのみ書き込む（空データによるスプレッドシート上書きを防止）
  function writeRotationIfNotEmpty(patterns, startRow, patternCount) {
    if (!patterns || patterns.length === 0) return;
    var hasData = patterns.some(function(pat) { return pat && pat.length > 0; });
    if (!hasData) return;
    writeRotation(patterns, startRow, patternCount);
  }

  // 夏季土曜（行13-21）: patterns 優先、旧形式 summerPatterns にも対応
  writeRotationIfNotEmpty(
    config.saturdayRotation ? (config.saturdayRotation.patterns || config.saturdayRotation.summerPatterns) : null,
    SCHEDULE_ROWS.summerSatRotation.start, 3);
  // 夏季日曜（行25-33）
  writeRotationIfNotEmpty(
    config.sundayRotation ? (config.sundayRotation.patterns || config.sundayRotation.summerPatterns) : null,
    SCHEDULE_ROWS.summerSunRotation.start, 3);
  // 冬季土曜（行37-54）: winterSaturdayRotation.patterns 優先
  writeRotationIfNotEmpty(
    config.winterSaturdayRotation ? config.winterSaturdayRotation.patterns :
      (config.saturdayRotation ? config.saturdayRotation.winterPatterns : null),
    SCHEDULE_ROWS.winterSatRotation.start, 6);
  // 冬季日曜（行58-75）
  writeRotationIfNotEmpty(
    config.winterSundayRotation ? config.winterSundayRotation.patterns :
      (config.sundayRotation ? config.sundayRotation.winterPatterns : null),
    SCHEDULE_ROWS.winterSunRotation.start, 6);
  // 夏季休暇（行80-88）
  writeRotationIfNotEmpty(
    config.summerVacationRotation ? config.summerVacationRotation.patterns : null,
    SCHEDULE_ROWS.summerVacRotation.start, 3);
  // 冬季休暇（行92-100）
  writeRotationIfNotEmpty(
    config.winterVacationRotation ? config.winterVacationRotation.patterns : null,
    SCHEDULE_ROWS.winterVacRotation.start, 3);

  // ローテーション開始番号（1〜12行目を検索して更新）
  var lastRow12 = sheet.getRange(1, 1, 12, 2).getValues();
  for (var r = 0; r < 12; r++) {
    var lbl = String(lastRow12[r][0]).trim();
    if ((lbl === '土曜開始番号'     || lbl === '土曜ローテーション開始')    && config.saturdayRotation)       { sheet.getRange(r+1,2).setValue((config.saturdayRotation.startIndex       || 0) + 1); }
    if ((lbl === '日曜開始番号'     || lbl === '日曜ローテーション開始')    && config.sundayRotation)         { sheet.getRange(r+1,2).setValue((config.sundayRotation.startIndex         || 0) + 1); }
    if ((lbl === '夏季休暇開始番号' || lbl === '夏季休暇ローテーション開始') && config.summerVacationRotation) { sheet.getRange(r+1,2).setValue((config.summerVacationRotation.startIndex  || 0) + 1); }
    if ((lbl === '冬季土曜開始番号' || lbl === '冬季土曜ローテーション開始') && config.winterSaturdayRotation) { sheet.getRange(r+1,2).setValue((config.winterSaturdayRotation.startIndex  || 0) + 1); }
    if ((lbl === '冬季日曜開始番号' || lbl === '冬季日曜ローテーション開始') && config.winterSundayRotation)   { sheet.getRange(r+1,2).setValue((config.winterSundayRotation.startIndex    || 0) + 1); }
    if ((lbl === '冬季休暇開始番号' || lbl === '冬季休暇ローテーション開始') && config.winterVacationRotation) { sheet.getRange(r+1,2).setValue((config.winterVacationRotation.startIndex  || 0) + 1); }
  }

  writeLog_('saveConfig', '管理者', '設定を保存しました');
  return { success: true };
}

// ==========================================
// saveRotation: 特定ローテーションのみ個別保存
// ==========================================
function saveRotation(body) {
  var sheet = SS.getSheetByName('設定');
  if (!sheet) return { success: false, error: '設定シートが見つかりません' };

  var rotType = body.rotationType;
  var patterns = body.patterns;

  if (!patterns || patterns.length === 0) {
    return { success: false, error: 'パターンデータが空です' };
  }

  // ローテーション種別 → 書き込み開始行のマッピング
  var rotMap = {
    'saturdayRotation':       SCHEDULE_ROWS.summerSatRotation.start,
    'sundayRotation':         SCHEDULE_ROWS.summerSunRotation.start,
    'summerVacationRotation': SCHEDULE_ROWS.summerVacRotation.start,
    'winterSaturdayRotation': SCHEDULE_ROWS.winterSatRotation.start,
    'winterSundayRotation':   SCHEDULE_ROWS.winterSunRotation.start,
    'winterVacationRotation': SCHEDULE_ROWS.winterVacRotation.start,
  };

  var startRow = rotMap[rotType];
  if (!startRow) return { success: false, error: '不明なローテーション種別: ' + rotType };

  // 送られたパターン数のみ書き込む（未送信パターン行は変更しない）
  var patternCount = patterns.length;
  for (var p = 0; p < patternCount; p++) {
    var pat = patterns[p] || [];
    for (var s = 0; s < 3; s++) {
      var rowNum = startRow + p * 3 + s;
      var timeSlot = ['8:00〜11:00', '11:00〜14:00', '14:00〜17:00'][s];
      sheet.getRange(rowNum, 2, 1, 8).clearContent();
      sheet.getRange(rowNum, 2).setValue(timeSlot);
      pat.filter(function(sl) { return sl.timeSlot === timeSlot; }).forEach(function(sl) {
        var idx = FACILITY_NAMES.indexOf(sl.facility);
        if (idx >= 0) sheet.getRange(rowNum, 3 + idx).setValue(sl.clubName);
      });
    }
  }

  writeLog_('saveRotation', '管理者', rotType + '（' + patternCount + 'パターン）を保存しました');
  return { success: true };
}

// ==========================================
// registerPush: プッシュ通知subscription保存
// ==========================================
function registerPush(body) {
  var sheet = SS.getSheetByName('プッシュ通知登録');
  if (!sheet) {
    sheet = SS.insertSheet('プッシュ通知登録');
    sheet.appendRow(['登録日時','クラブ名','endpoint','p256dh','auth']);
  }
  var sub = body.subscription || {};
  var endpoint = sub.endpoint || '';
  var keys = sub.keys || {};
  // 既存のendpointを検索して更新または追加
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]) === endpoint) {
      sheet.getRange(i + 1, 1, 1, 5).setValues([[new Date(), body.clubName || '', endpoint, keys.p256dh || '', keys.auth || '']]);
      writeLog_('registerPush', body.clubName || '', 'プッシュ通知登録更新');
      return { success: true };
    }
  }
  sheet.appendRow([new Date(), body.clubName || '', endpoint, keys.p256dh || '', keys.auth || '']);
  writeLog_('registerPush', body.clubName || '', 'プッシュ通知新規登録');
  return { success: true };
}

// ==========================================
// getPushStats: 通知統計取得
// ==========================================
function getPushStats() {
  var regSheet = SS.getSheetByName('プッシュ通知登録');
  var registeredCount = regSheet ? Math.max(0, regSheet.getLastRow() - 1) : 0;

  var logSheet = SS.getSheetByName('ログ');
  var history = [];
  if (logSheet) {
    var logData = logSheet.getDataRange().getValues();
    for (var i = logData.length - 1; i >= 1; i--) {
      if (String(logData[i][1]) === 'sendNotification') {
        history.push({
          timestamp: formatDateTime_(logData[i][0]),
          title: String(logData[i][3]).split('|')[0] || '',
          sent: parseInt(String(logData[i][3]).split('|')[1]) || 0,
        });
        if (history.length >= 10) break;
      }
    }
  }
  return { registeredCount: registeredCount, history: history };
}

// ==========================================
// sendNotification: Web Pushプロトコルで通知送信
// ==========================================
function sendNotification(title, body) {
  var VAPID_PUBLIC_KEY  = PropertiesService.getScriptProperties().getProperty('VAPID_PUBLIC_KEY')  || '';
  var VAPID_PRIVATE_KEY = PropertiesService.getScriptProperties().getProperty('VAPID_PRIVATE_KEY') || '';
  var VAPID_SUBJECT     = PropertiesService.getScriptProperties().getProperty('VAPID_SUBJECT')     || 'mailto:admin@example.com';

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    writeLog_('sendNotification', '管理者', title + '|0（VAPID未設定）');
    return { success: false, sent: 0, error: 'VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY が未設定です。GASスクリプトプロパティを確認してください。' };
  }

  var regSheet = SS.getSheetByName('プッシュ通知登録');
  if (!regSheet || regSheet.getLastRow() <= 1) {
    writeLog_('sendNotification', '管理者', title + '|0');
    return { success: true, sent: 0 };
  }

  var data = regSheet.getDataRange().getValues();
  var sent = 0;
  var payload = JSON.stringify({ title: title, body: body });

  for (var i = 1; i < data.length; i++) {
    var endpoint = String(data[i][2]);
    var p256dh   = String(data[i][3]);
    var auth     = String(data[i][4]);
    if (!endpoint) continue;
    try {
      // Web Push APIへのリクエスト（VAPID認証付き）
      // 注意：GASでVAPID JWTを生成するには追加実装が必要です
      // この実装はスケルトンです。実際の送信にはgas-web-push等のライブラリが必要です
      UrlFetchApp.fetch(endpoint, {
        method: 'post',
        headers: {
          'Authorization': 'vapid t=' + VAPID_PUBLIC_KEY + ',k=' + VAPID_PUBLIC_KEY,
          'Content-Type': 'application/octet-stream',
          'TTL': '86400',
        },
        payload: payload,
        muteHttpExceptions: true,
      });
      sent++;
    } catch (err) {
      Logger.log('Push送信失敗: ' + endpoint + ' / ' + err.message);
    }
  }
  writeLog_('sendNotification', '管理者', title + '|' + sent);
  return { success: true, sent: sent };
}

// ==========================================
// sendMonthlyReminder: 毎月15日の自動リマインド
// Time-drivenトリガーに設定してください
// ==========================================
function sendMonthlyReminder() {
  sendNotification('体育館予約 締め切り通知', '翌月分の占有予約申請の締め切りは今月10日です');
}

// ==========================================
// ユーティリティ
// ==========================================
function formatDate_(value) {
  if (!value) return '';
  var d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

function formatDateTime_(value) {
  if (!value) return '';
  var d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
}

function writeLog_(action, actor, detail) {
  var sheet = SS.getSheetByName('ログ');
  if (!sheet) {
    sheet = SS.insertSheet('ログ');
    sheet.appendRow(['タイムスタンプ','アクション','実行者','詳細']);
  }
  sheet.appendRow([new Date(), action, actor, detail]);
}

// ==========================================
// シート初期化
// ==========================================
function checkSheets() {
  var missing = [];
  if (!SS.getSheetByName('予約申請')) missing.push('予約申請');
  if (!SS.getSheetByName('ログ')) missing.push('ログ');
  if (!SS.getSheetByName('プッシュ通知登録')) missing.push('プッシュ通知登録');
  Logger.log('不足シート: ' + (missing.length === 0 ? 'なし' : missing.join(', ')));
  return { missing: missing };
}

function initializeSheets() {
  var result = { created: [] };

  if (!SS.getSheetByName('予約申請')) {
    var s = SS.insertSheet('予約申請');
    s.appendRow(['申請日時','申請者（クラブ）','半面A','半面B','全面','ステージ','第2全面','総合半面A','総合半面B','時間帯','内容','entryType','ステータス','コメント','管理者メモ','ID']);
    result.created.push('予約申請');
  }

  if (!SS.getSheetByName('ログ')) {
    var s = SS.insertSheet('ログ');
    s.appendRow(['タイムスタンプ','アクション','実行者','詳細']);
    result.created.push('ログ');
  }

  if (!SS.getSheetByName('プッシュ通知登録')) {
    var s = SS.insertSheet('プッシュ通知登録');
    s.appendRow(['登録日時','クラブ名','endpoint','p256dh','auth']);
    result.created.push('プッシュ通知登録');
  }

  Logger.log('作成したシート: ' + (result.created.length === 0 ? 'なし' : result.created.join(', ')));
  return result;
}

// ==========================================
// デバッグ関数
// ==========================================
function debugScanScheduleRows() {
  var sheet = SS.getSheetByName('設定');
  if (!sheet) { Logger.log('設定シートが見つかりません'); return; }
  var lastRow = sheet.getLastRow();
  var data = sheet.getRange(1, 1, Math.min(77, lastRow), 9).getValues();
  Logger.log('=== 設定シート 1〜77行目 ===');
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var nonEmpty = row.filter(function(c) { return c !== '' && c !== null; });
    if (nonEmpty.length > 0) {
      Logger.log((i + 1) + ': ' + row.map(function(c) {
        if (c instanceof Date) return Utilities.formatDate(c, 'Asia/Tokyo', 'MM/dd');
        return String(c);
      }).join(' | '));
    }
  }
}

function debugSchoolEvents() {
  var sheet = SS.getSheetByName('設定');
  if (!sheet) { Logger.log('設定シートが見つかりません'); return; }
  var data = sheet.getRange(115, 1, 106, 3).getValues();
  data.forEach(function(row, i) {
    if (row[0] || row[1]) {
      var dateVal = row[0] instanceof Date
        ? Utilities.formatDate(row[0], 'Asia/Tokyo', 'yyyy-MM-dd')
        : String(row[0]);
      Logger.log((115 + i) + ': 日付=' + dateVal + ' 行事名=' + row[1] + ' 種別=' + row[2]);
    }
  });
}

function testGetConfig() {
  var result = getConfig();
  Logger.log('クラブ数: ' + result.clubs.length);
  Logger.log('祝日数: ' + result.holidays.length);
  Logger.log('学校行事数: ' + result.schoolEvents.length);
  Logger.log('平日月曜スロット数: ' + (result.weekdaySchedule ? result.weekdaySchedule.monday.length : 0));
  Logger.log('夏季土曜パターン数: ' + (result.saturdayRotation ? result.saturdayRotation.summerPatterns.length : 0));
  Logger.log('冬季土曜パターン数: ' + (result.saturdayRotation ? result.saturdayRotation.winterPatterns.length : 0));
  Logger.log('夏季休暇パターン数: ' + (result.summerVacationRotation ? result.summerVacationRotation.patterns.length : 0));
  Logger.log('冬季休暇パターン数: ' + (result.winterVacationRotation ? result.winterVacationRotation.patterns.length : 0));
  Logger.log('rotationStartNumbers: ' + JSON.stringify(result.rotationStartNumbers));
}

function debugRotationRows() {
  var sheet = SS.getSheetByName('設定');
  [[80,'夏季休暇'],[92,'冬季休暇']].forEach(function(item) {
    var data = sheet.getRange(item[0], 1, 9, 9).getValues();
    Logger.log(item[1] + ':');
    data.forEach(function(row, i) {
      if (row.some(function(v){ return v; })) {
        Logger.log('  行' + (item[0]+i) + ': ' + row.join(' | '));
      }
    });
  });
}

function debugSheetRows() {
  var sheet = SS.getSheetByName('設定');
  var data = sheet.getRange(100, 1, 160, 2).getValues();
  data.forEach(function(row, i) {
    if (row[0] || row[1]) {
      Logger.log((100 + i) + ': ' + row[0] + ' | ' + row[1]);
    }
  });
}

function debugAdminPin() {
  var sheet = SS.getSheetByName('設定');
  var data = sheet.getRange(240, 1, 60, 2).getValues();
  data.forEach(function(row, i) {
    if (row[0] || row[1]) {
      Logger.log((240 + i) + ': ' + row[0] + ' | ' + row[1]);
    }
  });
}
