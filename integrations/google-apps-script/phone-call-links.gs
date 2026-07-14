/**
 * Calendar deep links for the Brisbane Calls Android app.
 *
 * Add the result of operationsPhoneCallLink_ to each Calendar Calls event
 * description. The HTTPS link opens Brisbane Calls on Tom's paired Pixel and
 * falls back to a protected setup page when the app is not installed.
 */

const OPERATIONS_PHONE_CALL_BASE = 'https://brisbanetvs.com/operations/phone/call/';

function operationsPhoneCallLink_(externalLeadId, source) {
  const reference = String(externalLeadId || '').trim();
  if (!reference) throw new Error('A stable lead ID is required for the phone link');
  const leadSource = String(source || '').trim() || 'google_lead_sheet';
  return OPERATIONS_PHONE_CALL_BASE
    + '?ref=' + encodeURIComponent(reference)
    + '&source=' + encodeURIComponent(leadSource);
}

function operationsAppendPhoneCallLink_(description, externalLeadId, source) {
  const existing = String(description || '').trim();
  const block = 'Open in Brisbane Calls:\n' + operationsPhoneCallLink_(externalLeadId, source);
  return existing ? existing + '\n\n' + block : block;
}
