import unittest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
import cron_tick


class CronTickUnitTests(unittest.TestCase):
    def test_registra_carnet_hora_de_guatemala_y_confirma(self):
        fixed = datetime(2026, 9, 8, 10, 30, tzinfo=cron_tick.GT_OFFSET)
        connection = MagicMock()
        connection.__enter__.return_value = connection
        cursor = connection.cursor.return_value.__enter__.return_value
        cursor.fetchone.return_value = (42,)
        with patch.object(cron_tick, 'ensure_tables') as ensure, \
             patch.object(cron_tick, 'get_connection', return_value=connection), \
             patch.object(cron_tick, 'datetime') as clock, patch('builtins.print'):
            clock.now.return_value = fixed
            cron_tick.main()
        ensure.assert_called_once()
        clock.now.assert_called_once_with(cron_tick.GT_OFFSET)
        sql, parameters = cursor.execute.call_args.args
        self.assertIn('INSERT INTO cron_ticks', sql)
        self.assertEqual(parameters, ('202307705', fixed, 'GMT-6'))
        self.assertEqual(parameters[1].utcoffset(), timedelta(hours=-6))
        connection.commit.assert_called_once()
