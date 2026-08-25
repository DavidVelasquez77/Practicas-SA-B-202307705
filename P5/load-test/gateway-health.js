import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '20s', target: 30 },
    { duration: '40s', target: 80 },
    { duration: '40s', target: 120 },
    { duration: '20s', target: 0 },
  ],

  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  const res = http.get('http://localhost:3100/health');

  check(res, {
    'status 200': (r) => r.status === 200,
  });

  sleep(0.05);
}