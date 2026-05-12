// Brisbane TVs — normalize lead, detect spam, build email
//
// n8n's Webhook node v2 wraps the incoming POST as:
//   { headers: {...}, params: {...}, query: {...}, body: {...}, webhookUrl: ..., executionMode: ... }
// So the actual JSON body the site sent us lives at `.body`. We unwrap
// defensively in case the workflow ever changes shape.
const raw = ($input.first() || {}).json || {};
const i = (raw && raw.body && typeof raw.body === 'object') ? raw.body : raw;

// Honeypot — any non-empty value means bot. `_bts_check` is the primary
// trap matched by the Pages Function; the legacy names are belt-and-braces.
const isSpam = !!(i._bts_check || i.company_website || i.honeypot || i.hp);
if (isSpam) {
  return [{ json: { isSpam: true } }];
}

const safe = (v, d = '') => (v === undefined || v === null) ? d : String(v).trim();
const lead = i.lead || {};
const job = i.job || {};
const tracking = i.tracking || {};
const server = i.server || {};

const name     = safe(lead.name, '(no name)');
const phone    = safe(lead.phone);
const email    = safe(lead.email);
const suburb   = safe(lead.suburb);
const postcode = safe(lead.postcode);

const tvCount    = job.tv_count || 1;
const sizeTier   = safe(job.size_tier);
const sizeLabel  = safe(job.size_label, sizeTier);
const pkgLabel   = safe(job.package_label);
const tvSize     = safe(job.tv_size);
const tvBrand    = safe(job.tv_brand);
const addons     = Array.isArray(job.addons) ? job.addons : [];
const wall       = safe(job.wall_type);
const date       = safe(job.preferred_date);
const estimate   = job.estimate_aud;
const notes      = safe(job.notes);
const photos     = Array.isArray(job.photos_attached) ? job.photos_attached : [];

const source  = safe(i.source, 'unknown');
const pageUrl = safe(i.page_url);

const isSubscribe = source === 'newsletter' || source === 'subscribe';

// Subject line
let subject;
if (isSubscribe) {
  subject = `New subscriber — ${email || name || 'no email'}`;
} else {
  const parts = [];
  if (pkgLabel)  parts.push(pkgLabel);
  else if (sizeLabel) parts.push(sizeLabel);
  if (suburb)    parts.push(suburb);
  if (estimate)  parts.push(`$${estimate}`);
  subject = `New lead — ${parts.join(' · ') || 'Brisbane TVs'}`;
}

// Click-to-call / mailto links
const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const telHref = phone ? phone.replace(/[^\d+]/g, '') : '';
const phoneLine = phone
  ? `<a href="tel:${esc(telHref)}" style="color:#403ed0;text-decoration:none;font-weight:600;">${esc(phone)}</a>`
  : '<span style="color:#999;">(not provided)</span>';
const emailLine = email
  ? `<a href="mailto:${esc(email)}" style="color:#403ed0;text-decoration:none;">${esc(email)}</a>`
  : '<span style="color:#999;">(not provided)</span>';

const hasJob = pkgLabel || sizeLabel || tvCount > 1 || tvSize || tvBrand || addons.length || wall || date || notes || estimate || photos.length;

const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#fff;border-radius:12px;padding:28px 28px 24px;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
      <div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#403ed0;font-weight:700;margin-bottom:6px;">${isSubscribe ? 'New Subscriber' : 'New Lead'}</div>
      <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#1a1a1a;">${esc(name)}</h1>
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:1.5;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;width:120px;">Phone</td><td style="padding:8px 0;">${phoneLine}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Email</td><td style="padding:8px 0;">${emailLine}</td></tr>
        ${(suburb || postcode) ? `<tr><td style="padding:8px 0;color:#666;">Suburb</td><td style="padding:8px 0;">${esc([suburb, postcode].filter(Boolean).join(' '))}</td></tr>` : ''}
      </table>
      ${hasJob ? `
      <div style="height:1px;background:#eee;margin:20px 0;"></div>
      <div style="font-size:12px;letter-spacing:0.8px;text-transform:uppercase;color:#999;font-weight:600;margin-bottom:10px;">Job Details</div>
      <table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;line-height:1.5;border-collapse:collapse;">
        ${pkgLabel ? `<tr><td style="padding:6px 0;color:#666;width:120px;">Package</td><td style="padding:6px 0;">${esc(pkgLabel)}</td></tr>` : ''}
        ${(tvSize || tvBrand) ? `<tr><td style="padding:6px 0;color:#666;">TV</td><td style="padding:6px 0;">${esc([tvSize ? tvSize + '"' : '', tvBrand].filter(Boolean).join(' · '))}${tvCount > 1 ? ` (×${tvCount})` : ''}</td></tr>` : (tvCount > 1 ? `<tr><td style="padding:6px 0;color:#666;">TV count</td><td style="padding:6px 0;">${tvCount}</td></tr>` : '')}
        ${(!pkgLabel && sizeLabel) ? `<tr><td style="padding:6px 0;color:#666;">Size tier</td><td style="padding:6px 0;">${esc(sizeLabel)}</td></tr>` : ''}
        ${addons.length ? `<tr><td style="padding:6px 0;color:#666;">Add-ons</td><td style="padding:6px 0;">${esc(addons.join(', '))}</td></tr>` : ''}
        ${wall  ? `<tr><td style="padding:6px 0;color:#666;">Wall type</td><td style="padding:6px 0;">${esc(wall)}</td></tr>` : ''}
        ${date  ? `<tr><td style="padding:6px 0;color:#666;">Preferred date</td><td style="padding:6px 0;">${esc(date)}</td></tr>` : ''}
        ${estimate ? `<tr><td style="padding:6px 0;color:#666;">Estimate</td><td style="padding:6px 0;font-weight:600;">$${esc(estimate)}</td></tr>` : ''}
        ${notes ? `<tr><td style="padding:6px 0;color:#666;vertical-align:top;">Notes</td><td style="padding:6px 0;white-space:pre-wrap;">${esc(notes)}</td></tr>` : ''}
        ${photos.length ? `<tr><td style="padding:6px 0;color:#666;vertical-align:top;">Photos</td><td style="padding:6px 0;">${esc(photos.length + ' attached')} — <em style="color:#999;">reply to ask customer to send them</em><div style="margin-top:4px;font-size:12px;color:#888;">${photos.map(p => esc(p.name + ' (' + p.size_kb + ' KB)')).join('<br>')}</div></td></tr>` : ''}
      </table>` : ''}
      <div style="height:1px;background:#eee;margin:20px 0;"></div>
      <div style="font-size:11px;color:#999;line-height:1.5;">
        <div><strong style="color:#666;">Source:</strong> ${esc(source)}${pageUrl ? ` · <a href="${esc(pageUrl)}" style="color:#999;">${esc(pageUrl)}</a>` : ''}</div>
        ${(tracking.utm_source || tracking.utm_campaign) ? `<div><strong style="color:#666;">UTM:</strong> ${esc([tracking.utm_source, tracking.utm_medium, tracking.utm_campaign].filter(Boolean).join(' / '))}</div>` : ''}
        ${tracking.referrer ? `<div><strong style="color:#666;">Referrer:</strong> ${esc(tracking.referrer)}</div>` : ''}
        ${server.ip ? `<div><strong style="color:#666;">IP:</strong> ${esc(server.ip)}${server.country ? ` (${esc(server.country)})` : ''}</div>` : ''}
      </div>
    </div>
    <div style="text-align:center;font-size:11px;color:#aaa;margin-top:14px;">Brisbane TVs · automated lead notification</div>
  </div>
</body></html>`;

return [{
  json: {
    isSpam: false,
    subject,
    html,
    name, phone, email, suburb, postcode,
    source, pageUrl,
    tvCount, sizeTier, sizeLabel, pkgLabel, tvSize, tvBrand, addons, wall, date, estimate, notes, photos
  }
}];
