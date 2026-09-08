import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

# Valores sintéticos locales: las unitarias nunca abren conexiones externas.
os.environ.update(DATABASE_URL='postgresql+psycopg://test:test@localhost/test',
                  COMICS_SERVICE_URL='http://localhost:3002/graphql', COPIES_SERVICE_URL='http://localhost:8002',
                  RABBITMQ_HOST='localhost', RABBITMQ_USER='test', RABBITMQ_PASSWORD='test')
from graphql import GraphQLError
from app.clients.errors import RemoteServiceError
from app.services.rentals_service import RentalsService


class RentalUnitTests(unittest.IsolatedAsyncioTestCase):
    async def test_invalid_days_stops_before_downstream_calls(self):
        with patch('app.services.rentals_service.ComicsClient.find_one', new_callable=AsyncMock) as comics:
            with self.assertRaisesRegex(GraphQLError, 'mayores que cero'):
                await RentalsService.create(SimpleNamespace(user_id=1, comic_id=1, dias=0))
            comics.assert_not_awaited()

    async def test_unavailable_copy_rejects_rental_before_database(self):
        with patch('app.services.rentals_service.ComicsClient.find_one', new_callable=AsyncMock,
                   return_value={'activo': True, 'precioAlquiler': 12.5}) as comics, \
             patch('app.services.rentals_service.CopiesClient.find_available', new_callable=AsyncMock,
                   side_effect=RemoteServiceError('No existen ejemplares disponibles')) as copies, \
             patch('app.services.rentals_service.SessionLocal') as database:
            with self.assertRaisesRegex(GraphQLError, 'No existen ejemplares disponibles'):
                await RentalsService.create(SimpleNamespace(user_id=1, comic_id=4, dias=2))
            comics.assert_awaited_once_with(4)
            copies.assert_awaited_once_with(4)
            database.assert_not_called()
