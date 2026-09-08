// Usa el runner integrado de Node sobre el build real; no añade otro framework.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AuthService } = require('../dist/auth/auth.service');
const { UnauthorizedException } = require('@nestjs/common');

function fixture() {
  const signed = [];
  const service = new AuthService(
    { user: { findMany: async () => [{ id: 7, correo: 'test@example.com', contrasena: 'valid-password', role: { nombre: 'Cliente' } }] } },
    { decrypt: value => value },
    { signAsync: async payload => { signed.push(payload); return 'test-token'; } },
    { getOrThrow: key => key === 'JWT_EXPIRES_IN' ? '60' : '120' },
  );
  return { service, signed };
}

test('login válido normaliza correo y firma la identidad y ventana de renovación', async () => {
  const { service, signed } = fixture();
  const before = Math.floor(Date.now() / 1000);
  const result = await service.login({ correo: ' TEST@EXAMPLE.COM ', contrasena: 'valid-password' });
  assert.deepEqual(result, { accessToken: 'test-token', user: { id: 7, rol: 'Cliente' } });
  assert.equal(signed.length, 99); // P7: fallo controlado; corregir a 1 tras capturar Actions.
  assert.equal(signed[0].sub, 7);
  assert.equal(signed[0].role, 'Cliente');
  assert.ok(signed[0].refreshUntil >= before + 180);
  assert.ok(signed[0].refreshUntil <= Math.floor(Date.now() / 1000) + 180);
});

test('contraseña incorrecta rechaza el login sin firmar un token', async () => {
  const { service, signed } = fixture();
  await assert.rejects(service.login({ correo: 'test@example.com', contrasena: 'wrong' }), UnauthorizedException);
  assert.deepEqual(signed, []);
});
