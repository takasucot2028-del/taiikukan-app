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

// 設定シートの行番号（debugScanScheduleRowsで確認済み）
var SCHEDULE_ROWS = {
  weekday:            { start: 5,  end: 9  }, // 月〜金（5行目〜9行目）
  summerSaturday:     { start: 13, end: 21 }, // 夏期土曜 3パターン×3スロット
  summerSunday:       { start: 25, end: 33 }, // 夏期日曜 3パターン×3スロット
  winterSaturday:     { start: 37, end: 54 }, // 冬期土曜 6パターン×3スロット（現在空）
  winterSunday:       { start: 58, end: 75 }, // 冬期日曜 6パターン×3スロット（現在空）
  clubs:              { start: 80, end: 89 },
  holidays:           { start: 93, end: 110 },
  schoolEvents:       { start: 115, end: 164 },
  adminPinRow:        166,
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
        return createResponse(getLogs());
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
    weekdaySchedule: null, saturdayRotation: null, sundayRotation: null };

  var lastRow = sheet.getLastRow();
  var lastCol = Math.max(sheet.getLastColumn(), 9);
  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();

  // ---- クラブ一覧 ----
  var clubs = [];
  for (var r = SCHEDULE_ROWS.clubs.start; r <= Math.min(SCHEDULE_ROWS.clubs.end, lastRow); r++) {
    var name = String(data[r - 1][0]).trim();
    if (name) clubs.push({ id: String(r), name: name });
  }

  // ---- 祝日 ----
  var holidays = [];
  for (var r = SCHEDULE_ROWS.holidays.start; r <= Math.min(SCHEDULE_ROWS.holidays.end, lastRow); r++) {
    var d = data[r - 1][0], n = String(data[r - 1][1]).trim();
    if (d && n) holidays.push({ date: formatDate_(d), name: n });
  }

  // ---- 学校行事 ----
  var schoolEvents = [];
  for (var r = SCHEDULE_ROWS.schoolEvents.start; r <= Math.min(SCHEDULE_ROWS.schoolEvents.end, lastRow); r++) {
    var d = data[r - 1][0], n = String(data[r - 1][1]).trim();
    if (d && n) schoolEvents.push({ date: formatDate_(d), name: n });
  }

  // ---- 管理者PIN ----
  var adminPin = '1234';
  var pinLabelIdx = SCHEDULE_ROWS.adminPinRow - 1;
  if (lastRow > SCHEDULE_ROWS.adminPinRow) {
    var label = String(data[pinLabelIdx][0]).trim();
    var pin   = String(data[pinLabelIdx + 1][0]).trim();
    if (label === '管理者PIN' && pin) adminPin = pin;
  }

  // ---- 平日固定スケジュール ----
  var weekdaySchedule = readWeekdaySchedule_(data);

  // ---- ローテーション（夏期・冬期） ----
  var summerSatPats = readRotationPatterns_(data, SCHEDULE_ROWS.summerSaturday.start, 3);
  var summerSunPats = readRotationPatterns_(data, SCHEDULE_ROWS.summerSunday.start,   3);
  var winterSatPats = readRotationPatterns_(data, SCHEDULE_ROWS.winterSaturday.start, 6);
  var winterSunPats = readRotationPatterns_(data, SCHEDULE_ROWS.winterSunday.start,   6);

  // ローテーション開始番号（A列に「土曜開始番号」「日曜開始番号」ラベルがある行を探す）
  var satStart = 0; // デフォルト：パターン①（0-indexed）
  var sunStart = 0;
  for (var r = 1; r <= Math.min(12, lastRow); r++) {
    var lbl = String(data[r - 1][0]).trim();
    if (lbl === '土曜開始番号' || lbl === '土曜ローテーション開始') {
      var v = parseInt(data[r - 1][1]);
      if (!isNaN(v) && v >= 1) satStart = v - 1; // 1-indexed → 0-indexed
    }
    if (lbl === '日曜開始番号' || lbl === '日曜ローテーション開始') {
      var v = parseInt(data[r - 1][1]);
      if (!isNaN(v) && v >= 1) sunStart = v - 1;
    }
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
      startIndex: satStart,
    },
    sundayRotation: {
      summerPatterns: summerSunPats,
      winterPatterns: winterSunPats,
      startIndex: sunStart,
    },
    rotationStartNumbers: { saturday: satStart + 1, sunday: sunStart + 1 },
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
function getLogs() {
  var sheet = SS.getSheetByName('ログ');
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  var logs = [];
  for (var i = Math.max(1, data.length - 100); i < data.length; i++) {
    logs.push({ timestamp: formatDateTime_(data[i][0]), action: String(data[i][1]),
      actor: String(data[i][2]), detail: String(data[i][3]) });
  }
  return logs.reverse();
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

function testGetConfig() {
  var result = getConfig();
  Logger.log('クラブ数: ' + result.clubs.length);
  Logger.log('祝日数: ' + result.holidays.length);
  Logger.log('学校行事数: ' + result.schoolEvents.length);
  Logger.log('平日月曜スロット数: ' + (result.weekdaySchedule ? result.weekdaySchedule.monday.length : 0));
  Logger.log('夏期土曜パターン数: ' + (result.saturdayRotation ? result.saturdayRotation.summerPatterns.length : 0));
  Logger.log('夏期土曜①スロット数: ' + (result.saturdayRotation && result.saturdayRotation.summerPatterns[0] ? result.saturdayRotation.summerPatterns[0].length : 0));
  Logger.log(JSON.stringify(result.saturdayRotation && result.saturdayRotation.summerPatterns[0]));
}
