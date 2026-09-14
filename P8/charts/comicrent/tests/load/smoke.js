import http from "k6/http";
import { check, sleep } from "k6";
export const options = { vus: 2, iterations: 10, thresholds: { http_req_failed: ["rate==0"], http_req_duration: ["p(95)<500"] } };
export default function () { const r = http.get("http://comicrent-api-gateway-canary.sa-p8.svc.cluster.local:3000/health"); check(r, { "gateway healthy": (x) => x.status === 200 }); sleep(0.2); }
