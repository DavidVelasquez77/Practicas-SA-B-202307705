import type { AddressInfo } from 'node:net';
import { correlationContext, startMetricsServer } from './http-observability';

describe('Comics Service observability', () => {
  it('keeps the incoming correlation ID available while handling the request', async () => {
    await correlationContext.run('comic-flow-123', async () => {
      expect(correlationContext.getStore()).toBe('comic-flow-123');
      await Promise.resolve();
      expect(correlationContext.getStore()).toBe('comic-flow-123');
    });
  });

  it('serves Prometheus metrics from its separate listener', async () => {
    const server = startMetricsServer(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/metrics`);
      const body = await response.text();
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/plain');
      expect(body).toContain('# HELP comicrent_http_requests_total');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
