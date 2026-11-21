import { jsonResponse, optionsResponse } from "../../lib/csl_dc_model.js";
import { CSL_MATCHES_BY_SEASON } from "../../lib/csl_matches.js";

export default function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") {
    return optionsResponse();
  }

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed. Use GET." }, 405);
  }

  const url = new URL(request.url);
  const season = url.searchParams.get("season") || "2026";
  const team = (url.searchParams.get("team") || "").trim();
  const limitRaw = url.searchParams.get("limit");

  let matches = CSL_MATCHES_BY_SEASON[season];
  if (!matches) {
    return jsonResponse(
      {
        error: `No matches found for season "${season}".`,
        available_seasons: Object.keys(CSL_MATCHES_BY_SEASON),
      },
      404
    );
  }

  if (team) {
    matches = matches.filter(
      (m) => m.home_team === team || m.away_team === team
    );
  }

  if (limitRaw) {
    const limit = Math.max(1, Number(limitRaw) || matches.length);
    matches = matches.slice(0, limit);
  }

  const res = jsonResponse(
    {
      season: Number(season),
      count: matches.length,
      matches,
    },
    200
  );
  res.headers.set("Cache-Control", "public, max-age=300, s-maxage=600");
  return res;
}
