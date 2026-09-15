import http from "k6/http";
import { check, sleep } from "k6";
export const options = { vus: 2, iterations: 10, thresholds: { http_req_failed: ["rate==0"], http_req_duration: ["p(95)<500"] } };
export default function () {
  if (!__ENV.BASE_URL) throw new Error("BASE_URL is required for canary analysis");
  const response = http.get(__ENV.BASE_URL);
  check(response, { "canary health status is 200": (r) => r.status === 200 });
  sleep(0.2);
}
