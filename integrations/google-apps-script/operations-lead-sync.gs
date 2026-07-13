/**
 * Brisbane TVs Operations lead synchroniser.
 *
 * Paste this alongside Code.gs in the Brisbane TVs Lead Ingest Apps Script
 * project. It sends leads from the existing `Leads` sheet to the protected
 * Cloudflare D1 Operations store. It never sends email.
 *
 * Required Script Properties (set in Project Settings, not source code):
 * - CLOUDFLARE_LEAD_SYNC_URL
 * - CLOUDFLARE_LEAD_SYNC_SECRET
 */

const OPERATIONS_SYNC_LEADS_SHEET = 'Leads';
const OPERATIONS_SYNC_CURSOR_PROPERTY = 'OPERATIONS_LEAD_SYNC_LAST_ROW';
const OPERATIONS_SYNC_URL_PROPERTY = 'CLOUDFLARE_LEAD_SYNC_URL';
const OPERATIONS_SYNC_SECRET_PROPERTY = 'CLOUDFLARE_LEAD_SYNC_SECRET';
const OPERATIONS_SYNC_BATCH_SIZE = 15;
const OPERATIONS_SYNC_MAX_ROWS_PER_RUN = 400;
const OPERATIONS_SYNC_TRIGGER_HANDLER = 'syncNewLeadsToOperations';

/**
 * Runs every five minutes after installOperationsLeadSyncTrigger_ is called.
 * Progress is stored after each successfully accepted batch, so a retry does
 * not create duplicate leads in Cloudflare.
 */
function syncNewLeadsToOperations() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Lead sync is already running');

  try {
    const config = operationsSyncConfig_();
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = spreadsheet.getSheetByName(OPERATIONS_SYNC_LEADS_SHEET);
    if (!sheet || sheet.getLastRow() < 2) {
      return { ok: true, sent: 0, skipped: 0, complete: true };
    }

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
    const headerIndex = operationsHeaderIndex_(headers);
    const properties = PropertiesService.getScriptProperties();
    let cursor = Number(properties.getProperty(OPERATIONS_SYNC_CURSOR_PROPERTY) || '1');
    if (!isFinite(cursor) || cursor < 1 || cursor > lastRow) cursor = 1;

    const startRow = Math.max(2, Math.floor(cursor) + 1);
    if (startRow > lastRow) {
      return { ok: true, sent: 0, skipped: 0, complete: true };
    }

    const rowCount = Math.min(OPERATIONS_SYNC_MAX_ROWS_PER_RUN, lastRow - startRow + 1);
    const rows = sheet.getRange(startRow, 1, rowCount, lastColumn).getValues();
    let sent = 0;
    let skipped = 0;

    for (let offset = 0; offset < rows.length; offset += OPERATIONS_SYNC_BATCH_SIZE) {
      const batchRows = rows.slice(offset, offset + OPERATIONS_SYNC_BATCH_SIZE);
      const leads = [];
      batchRows.forEach(function (row) {
        const lead = operationsLeadFromRow_(row, headerIndex);
        if (lead) leads.push(lead);
        else skipped += 1;
      });

      if (leads.length) {
        const result = operationsPostLeadBatch_(config, leads);
        if (!result || result.ok !== true) throw new Error('Cloudflare rejected the lead batch');
        sent += Number(result.completed || 0);
      }

      // Each successful batch advances the durable cursor. If this execution
      // ends early, the next run resumes from the first unsent sheet row.
      properties.setProperty(
        OPERATIONS_SYNC_CURSOR_PROPERTY,
        String(startRow + Math.min(offset + batchRows.length, rows.length) - 1),
      );
    }

    const complete = startRow + rowCount - 1 >= lastRow;
    return { ok: true, sent: sent, skipped: skipped, complete: complete };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Starts a clean, idempotent migration from the top of the existing Leads
 * sheet. Re-run this function until its return value says complete: true.
 */
function restartOperationsLeadMigration() {
  PropertiesService.getScriptProperties().setProperty(OPERATIONS_SYNC_CURSOR_PROPERTY, '1');
  return syncNewLeadsToOperations();
}

/**
 * Installs exactly one five-minute clock trigger for incremental lead sync.
 * No mail is sent and no external recipient is notified by this trigger.
 */
function installOperationsLeadSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === OPERATIONS_SYNC_TRIGGER_HANDLER) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger(OPERATIONS_SYNC_TRIGGER_HANDLER).timeBased().everyMinutes(5).create();
  return { ok: true, intervalMinutes: 5 };
}

function operationsSyncStatus() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(OPERATIONS_SYNC_LEADS_SHEET);
  const lastRow = sheet ? sheet.getLastRow() : 0;
  const cursor = Number(
    PropertiesService.getScriptProperties().getProperty(OPERATIONS_SYNC_CURSOR_PROPERTY) || '1',
  );
  return {
    ok: true,
    lastSheetRow: lastRow,
    lastSyncedRow: isFinite(cursor) ? cursor : 1,
    pendingRows: Math.max(0, lastRow - Math.max(1, isFinite(cursor) ? cursor : 1)),
  };
}

function operationsSyncConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const url = String(properties.getProperty(OPERATIONS_SYNC_URL_PROPERTY) || '').trim();
  const secret = String(properties.getProperty(OPERATIONS_SYNC_SECRET_PROPERTY) || '').trim();
  if (!/^https:\/\/brisbanetvs\.com\/api\/lead-sync$/.test(url)) {
    throw new Error('CLOUDFLARE_LEAD_SYNC_URL is not configured');
  }
  if (secret.length < 32) throw new Error('CLOUDFLARE_LEAD_SYNC_SECRET is not configured');
  return { url: url, secret: secret };
}

function operationsHeaderIndex_(headers) {
  const index = {};
  headers.forEach(function (header, column) {
    const key = String(header || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (key && index[key] === undefined) index[key] = column;
  });
  return index;
}

function operationsValue_(row, index, names) {
  for (let position = 0; position < names.length; position += 1) {
    const column = index[names[position]];
    if (column === undefined) continue;
    const value = row[column];
    if (value !== null && value !== undefined && String(value).trim()) return value;
  }
  return '';
}

function operationsIso_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value.toISOString();
  const text = String(value || '').trim();
  if (!text) return '';
  const date = new Date(text);
  return isNaN(date.getTime()) ? '' : date.toISOString();
}

function operationsText_(value, maximum) {
  return String(value == null ? '' : value).trim().slice(0, maximum);
}

function operationsLeadFromRow_(row, index) {
  const externalId = operationsText_(operationsValue_(row, index, ['id']), 160);
  const receivedAt = operationsIso_(operationsValue_(row, index, ['created_time', 'created_at']));
  if (!externalId || !receivedAt) return null;

  // Website enquiries already originate in Operations D1. They are copied to
  // the shared Leads sheet for the normal follow-up calendar workflow, but
  // must not be sent back into D1 as a second google_lead_sheet record.
  const rowSource = operationsText_(operationsValue_(row, index, ['source']), 64).toLowerCase();
  if (rowSource === 'website' || /^website:/i.test(externalId)) return null;

  return {
    source: 'google_lead_sheet',
    external_id: externalId,
    received_at: receivedAt,
    platform: operationsText_(operationsValue_(row, index, ['platform']), 96),
    full_name: operationsText_(operationsValue_(row, index, ['full_name', 'name']), 160),
    email: operationsText_(operationsValue_(row, index, ['email']), 254),
    phone: operationsText_(operationsValue_(row, index, ['phone_number', 'phone', 'mobile']), 64),
    postcode: operationsText_(operationsValue_(row, index, ['postcode']), 20),
    tv_size: operationsText_(operationsValue_(row, index, ['what_size_is_your_tv', 'tv_size']), 80),
    service: operationsText_(operationsValue_(row, index, ['want_to_get_your_tv_mounted', 'service']), 160),
    campaign: operationsText_(operationsValue_(row, index, ['campaign_name', 'campaign']), 200),
  };
}

function operationsPostLeadBatch_(config, leads) {
  const rawBody = JSON.stringify({ leads: leads });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const requestId = Utilities.getUuid();
  const material = timestamp + '.' + requestId + '.' + rawBody;
  const signature = Utilities.computeHmacSha256Signature(
    material,
    config.secret,
    Utilities.Charset.UTF_8,
  )
    .map(function (byte) { return ((byte + 256) % 256).toString(16).padStart(2, '0'); })
    .join('');

  const response = UrlFetchApp.fetch(config.url, {
    method: 'post',
    contentType: 'application/json',
    payload: rawBody,
    headers: {
      'x-lead-sync-timestamp': timestamp,
      'x-lead-sync-id': requestId,
      'x-lead-sync-signature': signature,
    },
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  let payload;
  try {
    payload = JSON.parse(response.getContentText());
  } catch (error) {
    throw new Error('Cloudflare returned an invalid response (' + status + ')');
  }
  if (status < 200 || status >= 300 || !payload || payload.ok !== true) {
    throw new Error('Cloudflare lead sync failed (' + status + ')');
  }
  return payload;
}
