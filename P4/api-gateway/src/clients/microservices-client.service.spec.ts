import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MicroservicesClientService } from './microservices-client.service';
import { correlationContext } from '../observability/http-observability';

describe('Gateway: comunicación downstream', () => {
  const config = new ConfigService({
    AUTH_SERVICE_URL: 'http://auth.test', COMICS_SERVICE_URL: 'http://comics.test/graphql',
    RENTALS_SERVICE_URL: 'http://rentals.test/graphql', COPIES_SERVICE_URL: 'http://copies.test',
  });
  afterEach(() => jest.restoreAllMocks());

  it('envía el login a Auth y conserva la cookie de respuesta', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 7 } }), { headers: { 'set-cookie': 'session=test; HttpOnly' } }),
    );
    const body = { correo: 'test@example.com', contrasena: 'test-only' };
    const result = await new MicroservicesClientService(config).authLogin(body);
    expect(fetchMock).toHaveBeenCalledWith('http://auth.test/auth/login', expect.objectContaining({
      method: 'POST', body: JSON.stringify(body),
    }));
    expect(result).toEqual({ data: { user: { id: 7 } }, setCookie: 'session=test; HttpOnly', jwtRenewed: undefined });
  });

  it('convierte una caída de red en HTTP 502', async () => {
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network unavailable'));
    await expect(new MicroservicesClientService(config).copiesRequest('/copies/7')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('propaga el identificador de correlación a Auth', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ valid: true, user: { id: 7, role: 'Cliente' } })),
    );

    await correlationContext.run('rental-flow-123', async () => {
      await new MicroservicesClientService(config).authValidate('access_token=test');
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://auth.test/auth/validate',
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: 'access_token=test',
          'X-Correlation-ID': 'rental-flow-123',
        }),
      }),
    );
  });
});
