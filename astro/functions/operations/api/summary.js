import { hasOperationsDatabase, json, requireOperationsAccess } from "./_lib/auth.js";
import { brisbaneDay, brisbaneDayDaysAgo, leadRecency } from "./_lib/dates.js";

function asCount(value) {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function platformLabel(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("instagram")) return "Instagram";
  if (text.includes("facebook") || text.includes("meta")) return "Facebook";
  if (text.includes("website") || text.includes("web")) return "Website";
  return "Other";
}

function tvSizeLabel(value) {
  const match = String(value || "").match(/\b(\d{2,3})\b/);
  if (!match) return "Unknown";
  const size = Number(match[1]);
  if (size < 55) return 'Under 55"';
  if (size < 65) return '55-64"';
  if (size < 75) return '65-74"';
  return '75"+';
}

function aggregateBuckets(rows, labelFor, order) {
  const counts = new Map(order.map((label) => [label, 0]));
  for (const row of rows || []) {
    const label = labelFor(row.value);
    counts.set(label, (counts.get(label) || 0) + asCount(row.count));
  }
  return order
    .map((label) => ({ label, count: counts.get(label) || 0 }))
    .filter((item) => item.count > 0);
}

export async function onRequestGet({ request, env }) {
  const access = await requireOperationsAccess(request, env);
  if (access.response) return access.response;
  if (!hasOperationsDatabase(env)) {
    console.error(JSON.stringify({ event: "operations_summary_database_not_configured" }));
    return json({ ok: false, error: "lead_store_unavailable" }, 503);
  }

  const now = new Date();
  const today = brisbaneDay(now);
  const weekStart = brisbaneDayDaysAgo(6, now);

  try {
    const [totalRow, todayRow, weekRow, latestRow, platformResult, sizeResult] = await Promise.all([
      env.OPERATIONS_DB.prepare("SELECT COUNT(*) AS count FROM leads").first(),
      env.OPERATIONS_DB.prepare("SELECT COUNT(*) AS count FROM leads WHERE received_day = ?")
        .bind(today)
        .first(),
      env.OPERATIONS_DB.prepare(
        "SELECT COUNT(*) AS count FROM leads WHERE received_day >= ? AND received_day <= ?",
      )
        .bind(weekStart, today)
        .first(),
      env.OPERATIONS_DB.prepare(
        "SELECT received_at FROM leads WHERE received_at IS NOT NULL ORDER BY received_at DESC, id DESC LIMIT 1",
      ).first(),
      env.OPERATIONS_DB.prepare(
        "SELECT platform AS value, COUNT(*) AS count FROM leads GROUP BY platform LIMIT 20",
      ).all(),
      env.OPERATIONS_DB.prepare(
        "SELECT tv_size AS value, COUNT(*) AS count FROM leads GROUP BY tv_size LIMIT 20",
      ).all(),
    ]);

    const totalLeads = asCount(totalRow?.count);
    const latestLeadRecency = latestRow?.received_at ? leadRecency(latestRow.received_at, now) : "none";
    const summary = {
      totalLeads,
      leadsToday: asCount(todayRow?.count),
      leadsLast7Days: asCount(weekRow?.count),
      latestLeadRecency,
      syncHealth: totalLeads === 0 ? "empty" : (latestLeadRecency === "older" ? "attention" : "ready"),
      byPlatform: aggregateBuckets(
        platformResult.results,
        platformLabel,
        ["Facebook", "Instagram", "Website", "Other"],
      ),
      byTvSize: aggregateBuckets(
        sizeResult.results,
        tvSizeLabel,
        ['Under 55"', '55-64"', '65-74"', '75"+', "Unknown"],
      ),
    };

    return json({ ok: true, summary });
  } catch (error) {
    console.error(JSON.stringify({
      event: "operations_summary_query_failed",
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    }));
    return json({ ok: false, error: "lead_store_unavailable" }, 503);
  }
}
