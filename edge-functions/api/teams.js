import {
  jsonResponse,
  listTeams,
  optionsResponse,
} from "../../lib/csl_dc_model.js";

export default function onRequest(context) {
  const { request } = context;

  if (request.method === "OPTIONS") {
    return optionsResponse();
  }

  if (request.method !== "GET") {
    return jsonResponse({ error: "Method not allowed. Use GET." }, 405);
  }

  return jsonResponse(listTeams(), 200);
}
