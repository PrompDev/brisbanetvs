import { hasOperationsDatabase, json, requireOperationsAccess } from "./_lib/auth.js";
import { brisbaneDay, brisbaneDayDaysAgo } from "./_lib/dates.js";

const ALLOWED_VIEWS = new Set([
  "overview",
  "calls",
  "quotes",
  "jobs",
  "stock",
  "finance",
  "social",
  "phone",
]);
const MAX_LIMIT = 100;
const MAX_OFFSET = 5_000;

function boundedInteger(value, fallback, maximum, minimum = 0) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isInteger(parsed) || parsed < minimum) return fallback;
  return Math.min(parsed, maximum);
}

function asCount(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function asCents(value) {
  const cents = Number(value);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : 0;
}

function safeText(value, maximum = 4_096) {
  return String(value == null ? "" : value).trim().slice(0, maximum);
}

function pagination(total, limit, offset) {
  return { total: asCount(total), limit, offset };
}

function structuredError(code, message, status, extra = {}) {
  return json({ ok: false, error: { code, message, ...extra } }, status);
}

function nonEmpty(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function configuredHttpsUrl(value) {
  if (!nonEmpty(value)) return false;
  try {
    return new URL(value.trim()).protocol === "https:";
  } catch {
    return false;
  }
}

function pairStatus(first, second, firstIsUrl = false) {
  const firstPresent = firstIsUrl ? configuredHttpsUrl(first) : nonEmpty(first);
  return firstPresent && nonEmpty(second) ? "configured" : "not_connected";
}

function connectorStatuses(env, sheetDelivery) {
  const sheetEndpointReady = configuredHttpsUrl(env.GOOGLE_APPS_SCRIPT_URL)
    || configuredHttpsUrl(env.PORTAL_APPS_SCRIPT_URL);
  const sheetDelivered = sheetEndpointReady
    && sheetDelivery?.status === "delivered"
    && nonEmpty(sheetDelivery?.delivered_at);
  const pbxStatus = pairStatus(env.PBX_PROVIDER, env.PBX_WEBHOOK_SECRET);
  const pixelRecordingStatus = hasOperationsDatabase(env) && Boolean(env.CALL_RECORDINGS)
    ? "configured"
    : "not_connected";
  const smsStatus = pairStatus(env.ANDROID_SMS_GATEWAY_URL, env.ANDROID_SMS_GATEWAY_TOKEN, true);
  const transcriptionStatus = pairStatus(env.TRANSCRIPTION_PROVIDER, env.TRANSCRIPTION_API_KEY);
  const stripeStatus = pairStatus(env.STRIPE_SECRET_KEY, env.STRIPE_WEBHOOK_SECRET);

  return [
    {
      key: "website",
      label: "Website leads",
      status: hasOperationsDatabase(env) ? "configured" : "not_connected",
      detail: "The canonical lead store is connected. Current intake still needs a labelled form test.",
      nextStep: "Submit one test enquiry and confirm it appears in Leads.",
    },
    {
      key: "google_sheet",
      label: "Google Sheet",
      status: sheetDelivered ? "ready" : sheetEndpointReady ? "configured" : "not_connected",
      detail: sheetDelivered
        ? "The delivery ledger contains a completed Google Sheet delivery."
        : "The delivery endpoint is configured but has no verified delivery in the ledger.",
      nextStep: "Confirm the same test enquiry creates one sheet row.",
    },
    {
      key: "calendar",
      label: "Calendar follow-up",
      status: sheetEndpointReady ? "configured" : "not_connected",
      detail: "Calendar follow-up runs after Sheet intake, but Operations has no separate completion receipt.",
      nextStep: "Confirm the test enquiry creates one follow-up event.",
    },
    {
      key: "pbx",
      label: "PBX call feed",
      status: pbxStatus,
      detail: pbxStatus === "configured"
        ? "Server settings are present. The signed call webhook still needs an end-to-end test."
        : "No voice provider is connected.",
      nextStep: "Choose the voice provider and whether Tom keeps, ports or diverts the current number.",
    },
    {
      key: "pixel_recording",
      label: "Pixel call recordings",
      status: pixelRecordingStatus,
      detail: pixelRecordingStatus === "configured"
        ? "Private upload storage and the canonical call index are connected."
        : "The private recording bucket or call index is unavailable.",
      nextStep: "Install and pair Brisbane Calls, then upload one announced test recording.",
    },
    {
      key: "sms",
      label: "Phone SMS gateway",
      status: smsStatus,
      detail: smsStatus === "configured"
        ? "Gateway settings are present. Sending and delivery callbacks still need an end-to-end test."
        : "No SMS gateway is connected.",
      nextStep: "Choose the Pixel SIM or a cloud SMS number, then connect delivery receipts and replies.",
    },
    {
      key: "transcription",
      label: "Call transcription",
      status: transcriptionStatus,
      detail: transcriptionStatus === "configured"
        ? "Provider settings are present. Recording consent and retention still need approval."
        : "No transcription provider is connected.",
      nextStep: "Confirm recording consent, provider and retention period.",
    },
    {
      key: "stripe",
      label: "Stripe payments",
      status: stripeStatus,
      detail: stripeStatus === "configured"
        ? "Stripe settings are present. Signed payment events still need an end-to-end test."
        : "Stripe is not connected to this workspace.",
      nextStep: "Connect Stripe after quote and invoice writes are approved.",
    },
  ];
}

function leadFollowUp(row) {
  return {
    id: safeText(row.id, 160),
    name: safeText(row.full_name, 160),
    service: safeText(row.service, 160),
    status: safeText(row.status || "new", 64),
    nextAction: safeText(row.next_action, 240),
    nextActionAt: safeText(row.next_action_at, 64),
  };
}

async function overviewData(db, limit) {
  const today = brisbaneDay();
  const weekStart = brisbaneDayDaysAgo(6);
  const followUpLimit = Math.min(limit, 12);
  const activeStatuses = "'won','lost','closed','cancelled','spam'";

  const [
    totalLeadRow,
    todayLeadRow,
    weekLeadRow,
    openLeadRow,
    pipelineResult,
    followUpResult,
    callsRow,
    quotesRow,
    jobsRow,
    invoicesRow,
    activitiesRow,
    stockRow,
    socialRow,
    smsRow,
  ] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM leads").first(),
    db.prepare("SELECT COUNT(*) AS count FROM leads WHERE received_day = ?").bind(today).first(),
    db.prepare("SELECT COUNT(*) AS count FROM leads WHERE received_day >= ? AND received_day <= ?")
      .bind(weekStart, today)
      .first(),
    db.prepare(`SELECT COUNT(*) AS count FROM leads WHERE LOWER(COALESCE(status, 'new')) NOT IN (${activeStatuses})`).first(),
    db.prepare(
      "SELECT COALESCE(NULLIF(TRIM(status), ''), 'new') AS status, COUNT(*) AS count "
      + "FROM leads GROUP BY COALESCE(NULLIF(TRIM(status), ''), 'new') "
      + "ORDER BY count DESC, status LIMIT 20",
    ).all(),
    db.prepare(
      `SELECT l.id, l.full_name, l.service, l.status, l.received_at, `
      + `(SELECT title FROM ops_activities a WHERE a.lead_id = l.id AND a.activity_type = 'follow_up' `
      + `AND a.completed_at = '' ORDER BY CASE WHEN a.due_at = '' THEN 1 ELSE 0 END, a.due_at, a.occurred_at DESC LIMIT 1) AS next_action, `
      + `(SELECT due_at FROM ops_activities a WHERE a.lead_id = l.id AND a.activity_type = 'follow_up' `
      + `AND a.completed_at = '' ORDER BY CASE WHEN a.due_at = '' THEN 1 ELSE 0 END, a.due_at, a.occurred_at DESC LIMIT 1) AS next_action_at `
      + `FROM leads l WHERE LOWER(COALESCE(l.status, 'new')) NOT IN (${activeStatuses}) `
      + `ORDER BY CASE WHEN next_action_at IS NULL OR next_action_at = '' THEN 1 ELSE 0 END, next_action_at, l.received_at DESC, l.id DESC LIMIT ?`,
    ).bind(followUpLimit).all(),
    db.prepare(
      "SELECT COUNT(*) AS total, "
      + "SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) AS missed, "
      + "SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed "
      + "FROM ops_calls",
    ).first(),
    db.prepare(
      "SELECT COUNT(*) AS total, "
      + "SUM(CASE WHEN status = 'needs_review' THEN 1 ELSE 0 END) AS needs_review, "
      + "SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent, "
      + "SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) AS accepted, "
      + "COALESCE(SUM(CASE WHEN status NOT IN ('declined','expired','cancelled') THEN total_cents ELSE 0 END), 0) AS pipeline_cents "
      + "FROM ops_quotes",
    ).first(),
    db.prepare(
      "SELECT COUNT(*) AS total, "
      + "SUM(CASE WHEN status IN ('tentative','scheduled','in_progress') THEN 1 ELSE 0 END) AS active, "
      + "SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed, "
      + "COALESCE(SUM(CASE WHEN status != 'cancelled' THEN revenue_cents ELSE 0 END), 0) AS revenue_cents "
      + "FROM ops_jobs",
    ).first(),
    db.prepare(
      "SELECT COUNT(*) AS total, "
      + "COALESCE(SUM(paid_cents), 0) AS collected_cents, "
      + "COALESCE(SUM(CASE WHEN status NOT IN ('paid','void') THEN total_cents - paid_cents ELSE 0 END), 0) AS outstanding_cents "
      + "FROM ops_invoices",
    ).first(),
    db.prepare(
      "SELECT COUNT(*) AS total, "
      + "SUM(CASE WHEN activity_type = 'follow_up' AND completed_at = '' THEN 1 ELSE 0 END) AS open_followups "
      + "FROM ops_activities",
    ).first(),
    db.prepare(
      "SELECT COUNT(*) AS total, SUM(CASE WHEN on_hand <= reorder_level THEN 1 ELSE 0 END) AS low_stock "
      + "FROM ops_supplies",
    ).first(),
    db.prepare(
      "SELECT COUNT(*) AS total, "
      + "SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS drafts, "
      + "SUM(CASE WHEN status IN ('approved','scheduled') THEN 1 ELSE 0 END) AS scheduled "
      + "FROM ops_social_posts",
    ).first(),
    db.prepare(
      "SELECT COUNT(*) AS total, "
      + "SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS drafts, "
      + "SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed, "
      + "SUM(CASE WHEN status IN ('sent','delivered') THEN 1 ELSE 0 END) AS sent "
      + "FROM ops_sms_queue",
    ).first(),
  ]);

  return {
    leads: {
      total: asCount(totalLeadRow?.count),
      today: asCount(todayLeadRow?.count),
      last7Days: asCount(weekLeadRow?.count),
      open: asCount(openLeadRow?.count),
      pipeline: (pipelineResult.results || []).map((row) => ({
        status: safeText(row.status, 64),
        count: asCount(row.count),
      })),
      recentFollowups: (followUpResult.results || []).map(leadFollowUp),
    },
    operations: {
      calls: {
        total: asCount(callsRow?.total),
        missed: asCount(callsRow?.missed),
        completed: asCount(callsRow?.completed),
      },
      quotes: {
        total: asCount(quotesRow?.total),
        needsReview: asCount(quotesRow?.needs_review),
        sent: asCount(quotesRow?.sent),
        accepted: asCount(quotesRow?.accepted),
        pipelineCents: asCents(quotesRow?.pipeline_cents),
      },
      jobs: {
        total: asCount(jobsRow?.total),
        active: asCount(jobsRow?.active),
        completed: asCount(jobsRow?.completed),
        revenueCents: asCents(jobsRow?.revenue_cents),
      },
      finance: {
        invoiceCount: asCount(invoicesRow?.total),
        collectedCents: asCents(invoicesRow?.collected_cents),
        outstandingCents: asCents(invoicesRow?.outstanding_cents),
      },
      activities: {
        total: asCount(activitiesRow?.total),
        openFollowups: asCount(activitiesRow?.open_followups),
      },
      stock: {
        total: asCount(stockRow?.total),
        lowStock: asCount(stockRow?.low_stock),
      },
      social: {
        total: asCount(socialRow?.total),
        drafts: asCount(socialRow?.drafts),
        scheduled: asCount(socialRow?.scheduled),
      },
      sms: {
        total: asCount(smsRow?.total),
        drafts: asCount(smsRow?.drafts),
        failed: asCount(smsRow?.failed),
        sent: asCount(smsRow?.sent),
      },
    },
  };
}

async function callsData(db, limit, offset) {
  const [result, totalRow] = await Promise.all([
    db.prepare(
      "SELECT c.id, c.direction, c.status, c.duration_seconds, c.started_at, l.full_name, l.phone, "
      + "(SELECT r.id FROM ops_call_recordings r WHERE r.call_id = c.id "
      + "ORDER BY r.created_at DESC LIMIT 1) AS recording_id "
      + "FROM ops_calls c LEFT JOIN leads l ON l.id = c.lead_id "
      + "ORDER BY c.started_at DESC, c.id DESC LIMIT ? OFFSET ?",
    ).bind(limit, offset).all(),
    db.prepare("SELECT COUNT(*) AS count FROM ops_calls").first(),
  ]);

  return {
    pagination: pagination(totalRow?.count, limit, offset),
    calls: (result.results || []).map((row) => ({
      id: safeText(row.id, 160),
      customer: safeText(row.full_name, 160),
      phone: safeText(row.phone, 64),
      direction: safeText(row.direction, 20),
      status: safeText(row.status, 32),
      durationSeconds: asCount(row.duration_seconds),
      startedAt: safeText(row.started_at, 64),
      recordingId: safeText(row.recording_id, 160),
    })),
  };
}

async function quotesData(db, limit, offset) {
  const [result, totalRow] = await Promise.all([
    db.prepare(
      "SELECT q.id, q.number, q.status, q.total_cents, q.updated_at, l.full_name, l.service FROM ops_quotes q "
      + "JOIN leads l ON l.id = q.lead_id ORDER BY q.created_at DESC, q.id DESC LIMIT ? OFFSET ?",
    ).bind(limit, offset).all(),
    db.prepare("SELECT COUNT(*) AS count FROM ops_quotes").first(),
  ]);

  return {
    pagination: pagination(totalRow?.count, limit, offset),
    quotes: (result.results || []).map((row) => ({
      id: safeText(row.id, 160),
      number: safeText(row.number, 80),
      customer: safeText(row.full_name, 160),
      service: safeText(row.service, 160),
      status: safeText(row.status, 32),
      totalCents: asCents(row.total_cents),
      updatedAt: safeText(row.updated_at, 64),
    })),
  };
}

async function jobsData(db, limit, offset) {
  const [result, totalRow] = await Promise.all([
    db.prepare(
      "SELECT j.id, j.status, j.scheduled_at, l.full_name, l.service "
      + "FROM ops_jobs j JOIN leads l ON l.id = j.lead_id "
      + "ORDER BY CASE WHEN j.scheduled_at = '' THEN 1 ELSE 0 END, j.scheduled_at, j.created_at DESC "
      + "LIMIT ? OFFSET ?",
    ).bind(limit, offset).all(),
    db.prepare("SELECT COUNT(*) AS count FROM ops_jobs").first(),
  ]);

  return {
    pagination: pagination(totalRow?.count, limit, offset),
    jobs: (result.results || []).map((row) => ({
      id: safeText(row.id, 160),
      customer: safeText(row.full_name, 160),
      service: safeText(row.service, 160),
      status: safeText(row.status, 32),
      scheduledAt: safeText(row.scheduled_at, 64),
    })),
  };
}

async function stockData(db, limit, offset) {
  const [suppliesResult, suppliesTotal, productsResult, productsTotal] = await Promise.all([
    db.prepare(
      "SELECT id, sku, name, category, on_hand, reorder_level, supplier, updated_at "
      + "FROM ops_supplies ORDER BY category, name, id LIMIT ? OFFSET ?",
    ).bind(limit, offset).all(),
    db.prepare("SELECT COUNT(*) AS count FROM ops_supplies").first(),
    db.prepare(
      "SELECT id, supplier, sku, name, bracket_type, min_size, max_size, price_cents, availability "
      + "FROM ops_supplier_products ORDER BY approved DESC, supplier, name, id LIMIT ? OFFSET ?",
    ).bind(limit, offset).all(),
    db.prepare("SELECT COUNT(*) AS count FROM ops_supplier_products").first(),
  ]);

  return {
    suppliesPagination: pagination(suppliesTotal?.count, limit, offset),
    productPagination: pagination(productsTotal?.count, limit, offset),
    supplies: (suppliesResult.results || []).map((row) => ({
      id: safeText(row.id, 160),
      sku: safeText(row.sku, 100),
      name: safeText(row.name, 240),
      category: safeText(row.category, 100),
      onHand: asCount(row.on_hand),
      reorderLevel: asCount(row.reorder_level),
      supplier: safeText(row.supplier, 160),
      updatedAt: safeText(row.updated_at, 64),
    })),
    products: (productsResult.results || []).map((row) => ({
      id: safeText(row.id, 160),
      supplier: safeText(row.supplier, 160),
      sku: safeText(row.sku, 100),
      name: safeText(row.name, 240),
      bracketType: safeText(row.bracket_type, 100),
      minSize: row.min_size == null ? null : asCount(row.min_size),
      maxSize: row.max_size == null ? null : asCount(row.max_size),
      priceCents: row.price_cents == null ? null : asCents(row.price_cents),
      availability: safeText(row.availability, 32),
    })),
  };
}

async function financeData(db, limit, offset) {
  const [summaryRow, result, totalRow] = await Promise.all([
    db.prepare(
      "SELECT COALESCE(SUM(total_cents), 0) AS invoiced_cents, "
      + "COALESCE(SUM(paid_cents), 0) AS collected_cents, "
      + "COALESCE(SUM(CASE WHEN status NOT IN ('paid','void') THEN total_cents - paid_cents ELSE 0 END), 0) AS outstanding_cents "
      + "FROM ops_invoices",
    ).first(),
    db.prepare(
      "SELECT i.id, i.number, i.status, i.total_cents, i.due_at, l.full_name FROM ops_invoices i "
      + "JOIN leads l ON l.id = i.lead_id "
      + "ORDER BY CASE WHEN i.issued_at = '' THEN 1 ELSE 0 END, i.issued_at DESC, i.created_at DESC "
      + "LIMIT ? OFFSET ?",
    ).bind(limit, offset).all(),
    db.prepare("SELECT COUNT(*) AS count FROM ops_invoices").first(),
  ]);

  return {
    summary: {
      invoicedCents: asCents(summaryRow?.invoiced_cents),
      collectedCents: asCents(summaryRow?.collected_cents),
      outstandingCents: asCents(summaryRow?.outstanding_cents),
    },
    pagination: pagination(totalRow?.count, limit, offset),
    invoices: (result.results || []).map((row) => ({
      id: safeText(row.id, 160),
      number: safeText(row.number, 80),
      customer: safeText(row.full_name, 160),
      status: safeText(row.status, 32),
      totalCents: asCents(row.total_cents),
      dueAt: safeText(row.due_at, 64),
    })),
  };
}

async function socialData(db, limit, offset) {
  const [result, totalRow] = await Promise.all([
    db.prepare(
      "SELECT id, title, campaign, scheduled_at, status FROM ops_social_posts "
      + "ORDER BY scheduled_at, id LIMIT ? OFFSET ?",
    ).bind(limit, offset).all(),
    db.prepare("SELECT COUNT(*) AS count FROM ops_social_posts").first(),
  ]);

  return {
    pagination: pagination(totalRow?.count, limit, offset),
    posts: (result.results || []).map((row) => ({
      id: safeText(row.id, 160),
      title: safeText(row.title, 240),
      scheduledAt: safeText(row.scheduled_at, 64),
      status: safeText(row.status, 32),
      campaign: safeText(row.campaign, 200),
    })),
  };
}

async function phoneData(db, env, limit, offset) {
  const [result, totalRow, sheetDelivery] = await Promise.all([
    db.prepare(
      "SELECT s.id, s.phone, s.message, s.status, s.created_at, l.full_name FROM ops_sms_queue s "
      + "LEFT JOIN leads l ON l.id = s.lead_id ORDER BY s.created_at DESC, s.id DESC LIMIT ? OFFSET ?",
    ).bind(limit, offset).all(),
    db.prepare("SELECT COUNT(*) AS count FROM ops_sms_queue").first(),
    db.prepare(
      "SELECT status, delivered_at FROM lead_deliveries "
      + "WHERE destination = 'google_sheet' AND status = 'delivered' AND delivered_at <> '' "
      + "ORDER BY delivered_at DESC, id DESC LIMIT 1",
    ).first(),
  ]);

  return {
    connectors: connectorStatuses(env, sheetDelivery),
    pagination: pagination(totalRow?.count, limit, offset),
    messages: (result.results || []).map((row) => ({
      id: safeText(row.id, 160),
      customer: safeText(row.full_name, 160),
      phone: safeText(row.phone, 64),
      message: safeText(row.message, 4_000),
      status: safeText(row.status, 32),
      createdAt: safeText(row.created_at, 64),
    })),
  };
}

async function dataForView(view, db, env, limit, offset) {
  if (view === "overview") return overviewData(db, limit);
  if (view === "calls") return callsData(db, limit, offset);
  if (view === "quotes") return quotesData(db, limit, offset);
  if (view === "jobs") return jobsData(db, limit, offset);
  if (view === "stock") return stockData(db, limit, offset);
  if (view === "finance") return financeData(db, limit, offset);
  if (view === "social") return socialData(db, limit, offset);
  return phoneData(db, env, limit, offset);
}

export async function onRequestGet({ request, env }) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return access.response;
  if (!hasOperationsDatabase(env)) {
    console.error(JSON.stringify({ event: "operations_workspace_database_not_configured" }));
    return structuredError(
      "workspace_store_unavailable",
      "The operations workspace is unavailable.",
      503,
    );
  }

  const url = new URL(request.url);
  const view = safeText(url.searchParams.get("view") || "overview", 32).toLowerCase();
  if (!ALLOWED_VIEWS.has(view)) {
    return structuredError(
      "invalid_view",
      "Choose a supported operations view.",
      400,
      { allowedViews: [...ALLOWED_VIEWS] },
    );
  }

  const limit = boundedInteger(url.searchParams.get("limit"), 50, MAX_LIMIT, 1);
  const offset = boundedInteger(url.searchParams.get("offset"), 0, MAX_OFFSET);

  try {
    const data = await dataForView(view, env.OPERATIONS_DB, env, limit, offset);
    return json({ ok: true, view, data });
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_workspace_query_failed",
      view,
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return structuredError(
      "workspace_store_unavailable",
      "The operations workspace could not be loaded.",
      503,
    );
  }
}
