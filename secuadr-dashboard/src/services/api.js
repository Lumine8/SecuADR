import axios from "axios";
import { mockDataset } from "../mock/mockDataset";

const configuredBase = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

const baseCandidates = [
  configuredBase,
  "http://localhost:5000",
  "http://localhost:5004",
  "http://localhost:5007",
  "http://localhost:5008",
].filter((value, index, arr) => !!value && arr.indexOf(value) === index);

let activeBase = configuredBase || "http://localhost:5000";

async function requestFromCandidates(config) {
  let lastError = null;

  for (const baseURL of baseCandidates) {
    try {
      const response = await axios({
        timeout: 15000,
        baseURL,
        ...config,
      });

      activeBase = baseURL;
      return response.data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No reachable SecuADR API endpoint");
}

async function withFallback(config, fallback) {
  try {
    const data = await requestFromCandidates(config);
    return {
      ...data,
      _source: "live",
      _base: activeBase,
    };
  } catch (error) {
    return {
      ...fallback,
      _source: "mock",
      _base: null,
      _error: error?.message,
    };
  }
}

export async function fetchUsers() {
  return withFallback(
    { method: "GET", url: "/users" },
    {
      success: true,
      users: mockDataset.users,
    },
  );
}

export async function fetchUserDetail(id) {
  return withFallback(
    { method: "GET", url: `/users/${id}` },
    {
      success: true,
      ...(mockDataset.userDetails[id] ||
        mockDataset.userDetails[mockDataset.users[0].id]),
    },
  );
}

export async function fetchSessions() {
  return withFallback(
    { method: "GET", url: "/sessions" },
    {
      success: true,
      sessions: mockDataset.sessions,
    },
  );
}

export async function fetchMetrics() {
  return withFallback(
    { method: "GET", url: "/metrics" },
    {
      success: true,
      metrics: mockDataset.metrics,
    },
  );
}

export async function fetchRisk() {
  return withFallback(
    { method: "GET", url: "/risk" },
    {
      success: true,
      risk: mockDataset.risk,
      flagged_sessions: mockDataset.flagged,
    },
  );
}

export function getActiveBase() {
  return activeBase;
}

export function subscribeRealtime(onUpdate, onError) {
  const streamUrl = `${activeBase || "http://localhost:5000"}/stream`;
  const stream = new EventSource(streamUrl);

  stream.addEventListener("connected", () => {
    // no-op: connection established
  });

  stream.addEventListener("update", (event) => {
    try {
      const payload = JSON.parse(event.data);
      onUpdate?.(payload);
    } catch {
      onUpdate?.({ collection: "unknown", operation: "unknown" });
    }
  });

  stream.addEventListener("stream_error", (event) => {
    try {
      onError?.(JSON.parse(event.data));
    } catch {
      onError?.({ message: "Realtime stream error" });
    }
  });

  stream.onerror = () => {
    onError?.({ message: "Realtime stream disconnected" });
  };

  return () => stream.close();
}
