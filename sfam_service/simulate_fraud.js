const http = require("http");

const HOST = process.env.SFAM_HOST || "127.0.0.1";
const PORT = Number(process.env.SFAM_PORT || 8000);
const PATH = "/process";

function postJson(payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request(
      {
        hostname: HOST,
        port: PORT,
        path: PATH,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      },
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function jitter(v, a) {
  return Math.max(0, v + (Math.random() * 2 - 1) * a);
}

(async () => {
  const userId = "fraud-sim-user";

  const legitBase = [0.48, 0.56, 0.13, 0.32, 0.24, 0.72];

  // Build behavioral baseline with slight natural jitter.
  for (let i = 0; i < 8; i++) {
    const vec = [
      jitter(legitBase[0], 0.03),
      jitter(legitBase[1], 0.04),
      jitter(legitBase[2], 0.02),
      jitter(legitBase[3], 0.03),
      jitter(legitBase[4], 0.03),
      jitter(legitBase[5], 0.04),
    ];
    await postJson({ user_id: userId, identity_vector: vec });
  }

  const scenarios = [
    {
      name: "Replay Attack (timing drift)",
      vector: [0.95, 0.57, 0.14, 0.31, 0.23, 0.71],
      expected: "timing_drift / step_up or block",
    },
    {
      name: "Imitation Attack (shape-speed mismatch)",
      vector: [0.5, 0.18, 0.14, 0.3, 0.62, 0.69],
      expected: "imitation_pattern_shift / warning+",
    },
    {
      name: "Scripted Bot Attack (robotic rhythm)",
      vector: [0.5, 0.08, 0.01, 0.34, 0.28, 0.99],
      expected: "scripted_replay_signature / warning+",
    },
    {
      name: "Path Manipulation Attack (irregular route)",
      vector: [0.49, 0.55, 0.15, 0.98, 0.25, 0.7],
      expected: "path_irregularity / warning+",
    },
    {
      name: "Social Engineering Proxy Attempt",
      vector: [0.58, 0.43, 0.31, 0.58, 0.51, 0.42],
      expected: "high anomaly / step_up or block",
    },
  ];

  console.log("\n=== Fraud Simulation Results ===\n");

  for (const s of scenarios) {
    const res = await postJson({ user_id: userId, identity_vector: s.vector });
    const out = res.body || {};

    console.log(`Scenario: ${s.name}`);
    console.log(`  Expected: ${s.expected}`);
    console.log(`  HTTP: ${res.status}`);
    console.log(`  Decision: ${out.decision}`);
    console.log(`  Risk: ${out.risk_level}`);
    console.log(`  Trust: ${out.trust_score}`);
    console.log(`  Failure Pattern: ${out.failure_pattern}`);
    console.log(`  Top Anomalies: ${(out.anomaly_features || []).join(", ")}`);
    console.log("---");
  }
})();
