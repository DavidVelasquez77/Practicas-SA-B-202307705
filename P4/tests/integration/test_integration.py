"""Tres integraciones reales. Ejecutar únicamente con compose.yaml de esta carpeta."""
import asyncio
import os
import unittest
from uuid import uuid4

import aio_pika
import httpx
import psycopg

from app.clients import comics_client, copies_client
from app.clients.errors import RemoteServiceError
from app.database import engine, init_db
from app.graphql.inputs import CreateRentalInput
from app.services.rentals_service import RentalsService


class ServiceIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        # Evita ejecutar accidentalmente contra una base ajena al compose de tests.
        self.assertEqual(os.environ['DATABASE_URL'], 'postgresql+psycopg://test:test@postgres:5432/rentals_test')
        self.http = httpx.AsyncClient(timeout=10)
        comics_client.http_client = self.http
        copies_client.http_client = self.http
        await init_db()
        response = await self.http.post(os.environ['COMICS_SERVICE_URL'], json={
            'query': 'mutation($input: CreateComicInput!) { createComic(input: $input) { id titulo precioAlquiler activo } }',
            'variables': {'input': {'titulo': 'P7-' + uuid4().hex, 'autor': 'Test', 'editorial': 'Test', 'genero': 'Test', 'precioAlquiler': 12.5}},
        })
        response.raise_for_status()
        self.assertNotIn('errors', response.json(), response.text)
        self.comic = response.json()['data']['createComic']

    async def asyncTearDown(self):
        await self.http.aclose()
        await engine.dispose()

    async def make_rental(self):
        response = await self.http.post(os.environ['COPIES_SERVICE_URL'] + '/copies', json={
            'comic_id': self.comic['id'], 'codigo': 'P7-' + uuid4().hex,
        })
        response.raise_for_status()
        copy = response.json()
        rental = await RentalsService.create(CreateRentalInput(user_id=1, comic_id=self.comic['id'], dias=2))
        return rental, copy

    async def test_1_rentals_consulta_comics_graphql_real(self):
        comic = await comics_client.ComicsClient.find_one(self.comic['id'])
        self.assertEqual(comic, self.comic)
        self.assertEqual(comic['precioAlquiler'], 12.5)
        with self.assertRaisesRegex(RemoteServiceError, 'no existe'):
            await comics_client.ComicsClient.find_one(2147483647)

    async def test_2_rentals_reserva_copia_real_y_persiste_alquiler(self):
        rental, copy = await self.make_rental()
        self.assertEqual(rental.copy_id, copy['id'])
        self.assertEqual(rental.precio_alquiler, 12.5)
        saved = await RentalsService.find_one(rental.id)
        self.assertEqual(saved.estado, 'ACTIVO')
        response = await self.http.get(os.environ['COPIES_SERVICE_URL'] + f"/copies/{copy['id']}")
        response.raise_for_status()
        self.assertEqual(response.json()['estado'], 'ALQUILADO')
        with self.assertRaisesRegex(RemoteServiceError, 'No existen ejemplares'):
            await copies_client.CopiesClient.find_available(self.comic['id'])

    async def test_3_evento_devolucion_cruza_rabbitmq_y_consumidor_confirma(self):
        rental, copy = await self.make_rental()
        # Espera la cola declarada por el consumer para evitar perder un evento temprano.
        ready = False
        for _ in range(60):
            connection = await aio_pika.connect_robust(host='rabbitmq', login='test', password='test')
            try:
                async with connection:
                    channel = await connection.channel()
                    await channel.declare_queue('copies.return.requested', passive=True)
                    ready = True
                    break
            except aio_pika.exceptions.ChannelNotFoundEntity:
                await asyncio.sleep(0.5)
        self.assertTrue(ready, 'El consumer no declaró su cola')
        result = await RentalsService.return_rental(rental.id)
        self.assertEqual(result.estado, 'DEVUELTO')
        for _ in range(60):
            response = await self.http.get(os.environ['COPIES_SERVICE_URL'] + f"/copies/{copy['id']}")
            response.raise_for_status()
            if response.json()['estado'] == 'DISPONIBLE':
                break
            await asyncio.sleep(0.5)
        self.assertEqual(response.json()['estado'], 'DISPONIBLE', 'El consumer no aplicó la devolución')
        with psycopg.connect(os.environ['COPIES_TEST_DATABASE_URL']) as db:
            rows = db.execute('SELECT event_id FROM processed_events').fetchall()
        self.assertGreaterEqual(len(rows), 1, 'No se registró la idempotencia del evento')
