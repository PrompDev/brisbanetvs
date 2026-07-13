import { hasOperationsDatabase, json, requireOperationsAccess } from "./_lib/auth.js";
import { brisbaneDay, brisbaneDayDaysAgo } from "./_lib/dates.js";

const MAX_LIMIT = 100;
const MAX_OFFSET = 1000;
const MAX_QUERY_LENGTH = 80;

function boundedInteger(value, fallback, maximum) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, maximum);
}

function requestedRange(value) {
  return ["today", "7d", "all"].includes(value) ? value : "today";
}

function searchTerm(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_QUERY_LENGTH);
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function toLead(row) {
  return {
    id: String(row.id || ""),
    name: String(row.full_name || ""),
    email: String(row.email || ""),
    phone: String(row.phone || ""),
    postcode: String(row.postcode || ""),
    source: String(row.platform || row.source || "Other"),
    tvSize: String(row.tv_size || ""),
    status: String(row.status || "new"),
    receivedAt: String(row.received_at || ""),
  };
}

export async function onRequestGet({ request, env }) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return access.response;
  if (!hasOperationsDatabase(env)) {
    console.error(JSON.stringify({ event: "operations_leads_database_not_configured" }));
    return json({ ok: false, error: "lead_store_unavailable" }, 503);
  }

  const url = new URL(request.url);
  const range = requestedRange(url.searchParams.get("range"));
  const limit = Math.max(1, boundedInteger(url.searchParams.get("limit"), 50, MAX_LIMIT));
  const offset = boundedInteger(url.searchParams.get("offset"), 0, MAX_OFFSET);
  const query = searchTerm(url.searchParams.get("q"));
  const where = [];
  const values = [];
  const now = new Date();

  if (range === "today") {
    where.push("received_day = ?");
    values.push(brisbaneDay(now));
  } else if (range === "7d") {
    where.push("received_day >= ? AND received_day <= ?");
    values.push(brisbaneDayDaysAgo(6, now), brisbaneDay(now));
  }

  if (query) {
    const pattern = `%${escapeLike(query)}%`;
    where.push(
      "(full_name LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR postcode LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\')",
    );
    values.push(pattern, pattern, pattern, pattern, pattern);
  }

  const whereClause = where.length ? ` WHERE ${where.join(" AND ")}` : "";
  const listSql = `SELECT id, full_name, email, phone, postcode, source, platform, tv_size, status, received_at FROM leads${whereClause} ORDER BY received_at DESC, id DESC LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) AS count FROM leads${whereClause}`;

  try {
    const [listResult, countRow] = await Promise.all([
      env.OPERATIONS_DB.prepare(listSql).bind(...values, limit, offset).all(),
      env.OPERATIONS_DB.prepare(countSql).bind(...values).first(),
    ]);
    const total = Number(countRow?.count) || 0;

    return json({
      ok: true,
      range,
      query: query || "",
      total: Number.isSafeInteger(total) && total >= 0 ? total : 0,
      offset,
      limit,
      leads: (listResult.results || []).map(toLead),
    });
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_leads_query_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "lead_store_unavailable" }, 503);
  }
}
