import { jsonResponse, optionsResponse } from "../../lib/csl_dc_model.js";
import { CSL_MATCHES_BY_SEASON } from "../../lib/csl_matches.js";

const ESPN_SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/chn.1/scoreboard";

function toBeijingTime(isoUtc) {
  if (!isoUtc) return "";
  const dt = new Date(isoUtc);
  const bj = new Date(dt.getTime() + 8 * 3600 * 1000);
  const y = bj.getUTCFullYear();
  const m = String(bj.getUTCMonth() + 1).padStart(2, "0");
  const d = String(bj.getUTCDate()).padStart(2, "0");
  const hh = String(bj.getUTCHours()).padStart(2, "0");
  const mm = String(bj.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function cachedJsonResponse(data, status = 200) {
  const res = jsonResponse(data, status);
  res.headers.set("Cache-Control", "public, max-age=300, s-maxage=600");
  return res;
}

export default async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") {
    return optionsResponse();
  }

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed. Use GET." }, 405);
  }

  const url = new URL(request.url);
  const season = url.searchParams.get("season") || "2026";
  const forceLive = url.searchParams.get("live") === "1";

  // Instant edge response from bundled dataset unless ?live=1 is requested
  if (!forceLive && CSL_MATCHES_BY_SEASON[season]) {
    const matches = CSL_MATCHES_BY_SEASON[season];
    return cachedJsonResponse(
      {
        season: Number(season),
        source: "edge-cache",
        count: matches.length,
        matches,
      },
      200
    );
  }

  try {
    const resp = await fetch(
      `${ESPN_SCOREBOARD_URL}?dates=${encodeURIComponent(season)}&limit=500`
    );
    if (!resp.ok) {
      return jsonResponse(
        { error: `Upstream ESPN API returned ${resp.status}` },
        502
      );
    }
    const payload = await resp.json();
    const events = payload.events || [];

    const matches = [];
    for (const ev of events) {
      const comp = ev.competitions?.[0];
      if (!comp) continue;
      const home = comp.competitors?.find((c) => c.homeAway === "home");
      const away = comp.competitors?.find((c) => c.homeAway === "away");
      if (!home || !away) continue;

      matches.push({
        id: String(ev.id || ""),
        season: Number(season),
        date_utc: ev.date || "",
        date_beijing: toBeijingTime(ev.date),
        home_team: home.team?.displayName || "",
        away_team: away.team?.displayName || "",
        home_goals: home.score != null ? Number(home.score) : null,
        away_goals: away.score != null ? Number(away.score) : null,
        status: ev.status?.type?.name || "",
        venue: comp.venue?.fullName || "",
      });
    }

    matches.sort((a, b) => b.date_utc.localeCompare(a.date_utc));

    return cachedJsonResponse(
      {
        season: Number(season),
        source: "espn-live",
        count: matches.length,
        matches,
      },
      200
    );
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}
