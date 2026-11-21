import {
  jsonResponse,
  optionsResponse,
  predictMatch,
} from "../../lib/csl_dc_model.js";
import { MODEL_PARAMS } from "../../lib/model_params.js";

export default async function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") {
    return optionsResponse();
  }

  let home = "";
  let away = "";

  if (request.method === "GET") {
    const url = new URL(request.url);
    home = (url.searchParams.get("home") || "").trim();
    away = (url.searchParams.get("away") || "").trim();
  } else if (request.method === "POST") {
    try {
      const body = await request.json();
      home = String(body?.home || "").trim();
      away = String(body?.away || "").trim();
    } catch {
      return jsonResponse({ error: "Invalid JSON request body." }, 400);
    }
  } else {
    return jsonResponse({ error: "Method not allowed. Use GET or POST." }, 405);
  }

  if (!home || !away) {
    return jsonResponse(
      {
        error: "Both 'home' and 'away' parameters are required.",
        example_get:
          "/api/predict?home=Shanghai%20Port%20FC&away=Shanghai%20Shenhua%20FC",
        available_teams: Object.keys(MODEL_PARAMS.teams),
      },
      400
    );
  }

  try {
    const result = predictMatch(home, away);
    return jsonResponse(result, 200);
  } catch (err) {
    return jsonResponse(
      {
        error: err.message,
        available_teams: Object.keys(MODEL_PARAMS.teams),
      },
      400
    );
  }
}
