import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate==0"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  const response = http.get(__ENV.BASE_URL || "http://localhost:3000/health");
  check(response, { "health status 200": (r) => r.status === 200 });
  sleep(0.2);
}
