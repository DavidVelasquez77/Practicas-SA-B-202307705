import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

os.environ.update(DATABASE_URL='postgresql+psycopg://test:test@localhost/test',
                  RABBITMQ_HOST='localhost', RABBITMQ_USER='test', RABBITMQ_PASSWORD='test')
from fastapi import HTTPException
from app.services.copies_service import CopiesService


class CopiesUnitTests(unittest.IsolatedAsyncioTestCase):
    async def test_reserva_copia_disponible_actualiza_estado_y_confirma(self):
        copy = SimpleNamespace(id=7, estado='DISPONIBLE')
        session = AsyncMock()
        session.get.return_value = copy
        context = MagicMock()
        context.__aenter__ = AsyncMock(return_value=session)
        context.__aexit__ = AsyncMock(return_value=False)
        with patch('app.services.copies_service.SessionLocal', return_value=context):
            result = await CopiesService.mark_as_rented(7)
        self.assertIs(result, copy)
        self.assertEqual(copy.estado, 'ALQUILADO')
        session.commit.assert_awaited_once()
        session.refresh.assert_awaited_once_with(copy)

    async def test_copia_inexistente_responde_404_sin_confirmar(self):
        session = AsyncMock()
        session.get.return_value = None
        context = MagicMock()
        context.__aenter__ = AsyncMock(return_value=session)
        context.__aexit__ = AsyncMock(return_value=False)
        with patch('app.services.copies_service.SessionLocal', return_value=context):
            with self.assertRaises(HTTPException) as raised:
                await CopiesService.mark_as_rented(999)
        self.assertEqual(raised.exception.status_code, 404)
        session.commit.assert_not_awaited()
