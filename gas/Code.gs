// ==========================================
// 体育館予約管理 - GAS API メイン処理
// ==========================================

var SPREADSHEET_ID = '1tUmnLtQGJVNdaQ0mGaQku8KEwuhmDF-z7lU48sSlKjo'; // ← スプレッドシートIDを入力
var SS = SpreadsheetApp.openById(SPREADSHEET_ID);

// CORS対応レスポンスヘッダー
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
      default:
        return createResponse({ error: 'Unknown action: ' + action });
    }
  } catch (err) {
    return createResponse({ error: err.message });
  }
}

// ==========================================
// getConfig: クラブ一覧・設定データ取得
// ==========================================
function getConfig() {
  var sheet = SS.getSheetByName('設定');
  if (!sheet) return { clubs: [], holidays: [], schoolEvents: [], adminPin: '1234' };

  var data = sheet.getDataRange().getValues();
  var clubs = [];
  var holidays = [];
  var schoolEvents = [];
  var adminPin = '1234';

  var section = '';
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;

    var key = String(row[0]).trim();
    if (key === 'クラブ一覧') { section = 'clubs'; continue; }
    if (key === '祝日') { section = 'holidays'; continue; }
    if (key === '学校行事') { section = 'schoolEvents'; continue; }
    if (key === '管理者PIN') { adminPin = String(row[1]); continue; }

    if (section === 'clubs' && row[0]) {
      clubs.push({ id: String(i), name: String(row[0]) });
    } else if (section === 'holidays' && row[0] && row[1]) {
      holidays.push({ date: formatDate_(row[0]), name: String(row[1]) });
    } else if (section === 'schoolEvents' && row[0] && row[1]) {
      schoolEvents.push({ date: formatDate_(row[0]), name: String(row[1]) });
    }
  }

  return { clubs: clubs, holidays: holidays, schoolEvents: schoolEvents, adminPin: adminPin };
}

// ==========================================
// getReservations: 予約申請一覧取得
// ==========================================
function getReservations(year, month) {
  var sheet = SS.getSheetByName('予約申請');
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  var reservations = [];
  var y = parseInt(year);
  var m = parseInt(month);

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row[0]) continue;

    var date = formatDate_(row[3]);
    var parts = date.split('-');
    if (parseInt(parts[0]) !== y || parseInt(parts[1]) !== m) continue;

    reservations.push({
      id: String(row[0]),
      createdAt: formatDateTime_(row[1]),
      clubName: String(row[2]),
      date: date,
      timeSlot: String(row[4]),
      facility: String(row[5]),
      content: String(row[6]),
      comment: String(row[7]),
      status: String(row[8]),
      adminMemo: String(row[9] || ''),
      updatedAt: formatDateTime_(row[10]),
    });
  }
  return reservations;
}

// ==========================================
// addReservation: 予約申請追加
// ==========================================
function addReservation(body) {
  var sheet = SS.getSheetByName('予約申請');
  if (!sheet) {
    sheet = SS.insertSheet('予約申請');
    sheet.appendRow(['申請ID', '申請日時', 'クラブ名', '対象日', '時間帯', '占有施設', '占有内容', 'コメント', 'ステータス', '管理者メモ', '最終更新日時']);
  }

  var id = Utilities.getUuid();
  var now = new Date();
  sheet.appendRow([
    id,
    now,
    body.clubName,
    new Date(body.date),
    body.timeSlot,
    body.facility,
    body.content,
    body.comment || '',
    '申請中',
    '',
    now,
  ]);

  writeLog_('addReservation', body.clubName, '予約申請：' + body.date + ' ' + body.content);
  return { success: true, id: id };
}

// ==========================================
// updateReservation: 予約申請更新・取り消し
// ==========================================
function updateReservation(body) {
  var sheet = SS.getSheetByName('予約申請');
  if (!sheet) return { success: false, error: 'シートが見つかりません' };

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(body.id)) {
      var row = i + 1;
      if (body.date) sheet.getRange(row, 4).setValue(new Date(body.date));
      if (body.timeSlot) sheet.getRange(row, 5).setValue(body.timeSlot);
      if (body.facility) sheet.getRange(row, 6).setValue(body.facility);
      if (body.content) sheet.getRange(row, 7).setValue(body.content);
      if (body.comment !== undefined) sheet.getRange(row, 8).setValue(body.comment);
      if (body.status) sheet.getRange(row, 9).setValue(body.status);
      sheet.getRange(row, 11).setValue(new Date());
      writeLog_('updateReservation', data[i][2], '予約更新：' + body.id);
      return { success: true };
    }
  }
  return { success: false, error: '該当IDが見つかりません' };
}

// ==========================================
// updateStatus: ステータス変更（管理者用）
// ==========================================
function updateStatus(body) {
  var sheet = SS.getSheetByName('予約申請');
  if (!sheet) return { success: false };

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(body.id)) {
      var row = i + 1;
      sheet.getRange(row, 9).setValue(body.status);
      if (body.adminMemo !== undefined) sheet.getRange(row, 10).setValue(body.adminMemo);
      sheet.getRange(row, 11).setValue(new Date());
      writeLog_('updateStatus', '管理者', 'ステータス変更：' + body.id + ' → ' + body.status);
      return { success: true };
    }
  }
  return { success: false };
}

// ==========================================
// getLogs: ログ取得
// ==========================================
function getLogs() {
  var sheet = SS.getSheetByName('ログ');
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  var logs = [];
  for (var i = Math.max(1, data.length - 100); i < data.length; i++) {
    logs.push({
      timestamp: formatDateTime_(data[i][0]),
      action: String(data[i][1]),
      actor: String(data[i][2]),
      detail: String(data[i][3]),
    });
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
    sheet.appendRow(['タイムスタンプ', 'アクション', '実行者', '詳細']);
  }
  sheet.appendRow([new Date(), action, actor, detail]);
}
