import { MODEL_PARAMS } from "./model_params.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...CORS_HEADERS,
    },
  });
}

export function optionsResponse() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

function poissonPmf(kMax, lambda) {
  const probs = new Array(kMax + 1);
  probs[0] = Math.exp(-lambda);
  for (let k = 1; k <= kMax; k++) {
    probs[k] = (probs[k - 1] * lambda) / k;
  }
  return probs;
}

export function predictMatch(homeTeam, awayTeam, maxGoals = 10) {
  const { mu, home_adv, rho, teams } = MODEL_PARAMS;
  const h = teams[homeTeam];
  const a = teams[awayTeam];

  if (!h) {
    throw new Error(`Unknown home team: "${homeTeam}"`);
  }
  if (!a) {
    throw new Error(`Unknown away team: "${awayTeam}"`);
  }
  if (homeTeam === awayTeam) {
    throw new Error("Home team and away team must be different.");
  }

  const lambdaHome = Math.exp(mu + home_adv + h.attack + a.defense);
  const lambdaAway = Math.exp(mu + a.attack + h.defense);

  const pH = poissonPmf(maxGoals, lambdaHome);
  const pA = poissonPmf(maxGoals, lambdaAway);

  const matrix = Array.from({ length: maxGoals + 1 }, (_, i) =>
    Array.from({ length: maxGoals + 1 }, (_, j) => pH[i] * pA[j])
  );

  // Dixon-Coles low-score correction
  matrix[0][0] *= Math.max(1 - lambdaHome * lambdaAway * rho, 1e-12);
  matrix[0][1] *= Math.max(1 + lambdaHome * rho, 1e-12);
  matrix[1][0] *= Math.max(1 + lambdaAway * rho, 1e-12);
  matrix[1][1] *= Math.max(1 - rho, 1e-12);

  let total = 0;
  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      total += matrix[i][j];
    }
  }

  let probHome = 0;
  let probDraw = 0;
  let probAway = 0;
  let probOver25 = 0;
  let probBtts = 0;
  const scores = [];

  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const p = matrix[i][j] / total;
      if (i > j) probHome += p;
      else if (i === j) probDraw += p;
      else probAway += p;

      if (i + j >= 3) probOver25 += p;
      if (i >= 1 && j >= 1) probBtts += p;
      scores.push({ score: `${i}-${j}`, probability: p });
    }
  }

  scores.sort((x, y) => y.probability - x.probability);

  return {
    home_team: homeTeam,
    away_team: awayTeam,
    expected_goals: {
      home: Number(lambdaHome.toFixed(4)),
      away: Number(lambdaAway.toFixed(4)),
    },
    probabilities: {
      home_win: Number(probHome.toFixed(4)),
      draw: Number(probDraw.toFixed(4)),
      away_win: Number(probAway.toFixed(4)),
      over_2_5: Number(probOver25.toFixed(4)),
      under_2_5: Number((1 - probOver25).toFixed(4)),
      btts: Number(probBtts.toFixed(4)),
    },
    scores: scores.map((s) => ({
      score: s.score,
      probability: Number(s.probability.toFixed(6)),
    })),
    model: {
      name: MODEL_PARAMS.model_name,
      seasons: MODEL_PARAMS.seasons,
      matches_trained: MODEL_PARAMS.matches_trained,
      half_life_days: MODEL_PARAMS.half_life_days,
      rho: Number(rho.toFixed(4)),
    },
  };
}

export function listTeams() {
  const list = Object.entries(MODEL_PARAMS.teams).map(([team, stats]) => ({
    team,
    ...stats,
  }));
  return {
    model: {
      name: MODEL_PARAMS.model_name,
      seasons: MODEL_PARAMS.seasons,
      matches_trained: MODEL_PARAMS.matches_trained,
      half_life_days: MODEL_PARAMS.half_life_days,
      mu: Number(MODEL_PARAMS.mu.toFixed(4)),
      home_adv: Number(MODEL_PARAMS.home_adv.toFixed(4)),
      rho: Number(MODEL_PARAMS.rho.toFixed(4)),
    },
    count: list.length,
    teams: list,
  };
}
