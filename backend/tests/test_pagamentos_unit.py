"""Testes sem banco, rede ou importação de main (que executa migrações).

Executar: python -m unittest discover -s backend/tests -p test_pagamentos_unit.py
"""
import ast
import unittest
from datetime import date, datetime, timedelta
from pathlib import Path
from unittest.mock import Mock

from fastapi import HTTPException
from pydantic import BaseModel, ValidationError, validator, field_validator


class PagamentosTest(unittest.TestCase):
    def setUp(self):
        arvore = ast.parse((Path(__file__).parents[1] / 'main.py').read_text(encoding='utf-8'))
        nomes = {'PagarBoleto', 'BoletoPagarLote', 'BoletoCreate', 'registrar_pagamentos', 'criar_boleto'}
        nodes = [n for n in arvore.body if isinstance(n, (ast.FunctionDef, ast.ClassDef)) and n.name in nomes]
        for n in nodes:
            if isinstance(n, ast.FunctionDef):
                n.decorator_list = []
                n.args.defaults = []
                for argumento in n.args.args:
                    argumento.annotation = None
        self.conexao = Mock()
        self.cursor = self.conexao.cursor.return_value
        self.cursor.fetchall.return_value = [(1, 'Pendente'), (2, 'Pendente')]
        self.ns = {'BaseModel': BaseModel, 'validator': validator, 'field_validator': field_validator, 'date': date, 'datetime': datetime,
                   'HTTPException': HTTPException, 'agora_br': datetime.now,
                   'get_connection': lambda: self.conexao, 'registrar_auditoria': Mock()}
        exec(compile(ast.Module(body=nodes, type_ignores=[]), 'main-unit', 'exec'), self.ns)
        self.dados = self.ns['PagarBoleto'](metodo_pagamento='Pix', banco='Itaú', data_pagamento=date.today())

    def registrar(self, ids):
        return self.ns['registrar_pagamentos'](ids, self.dados, {'id': 7})

    def test_lote_deduplica_e_registra_metadados_uma_vez(self):
        resultado = self.registrar([2, 1, 1])
        self.assertEqual(resultado['ids'], [1, 2])
        self.assertEqual(resultado['quantidade'], 2)
        self.assertIn('FOR UPDATE', self.cursor.execute.call_args_list[0].args[0])
        params = self.cursor.execute.call_args_list[1].args[1]
        self.assertEqual(params[:2], ('Pix', 'Itaú'))
        self.assertEqual(params[2].date(), date.today())
        self.conexao.commit.assert_called_once()
        self.assertEqual(self.ns['registrar_auditoria'].call_count, 2)
        self.conexao.close.assert_called_once()

    def test_pagamento_existente_rejeita_lote_inteiro(self):
        self.cursor.fetchall.return_value = [(1, 'Pendente'), (2, 'Pago')]
        with self.assertRaises(HTTPException) as erro:
            self.registrar([1, 2])
        self.assertEqual(erro.exception.status_code, 409)
        self.assertEqual(self.cursor.execute.call_count, 1)
        self.conexao.commit.assert_not_called()
        self.conexao.rollback.assert_called_once()
        self.conexao.close.assert_called_once()
        self.ns['registrar_auditoria'].assert_not_called()

    def test_excluido_ou_inexistente_nao_produz_pagamento_parcial(self):
        self.cursor.fetchall.return_value = [(1, 'Pendente')]
        with self.assertRaises(HTTPException) as erro:
            self.registrar([1, 2])
        self.assertEqual(erro.exception.status_code, 404)
        self.conexao.commit.assert_not_called()

    def test_ids_vazios_nao_abrem_transacao(self):
        with self.assertRaises(HTTPException):
            self.registrar([])
        self.conexao.cursor.assert_not_called()

    def test_falha_no_update_faz_rollback(self):
        self.cursor.execute.side_effect = [None, RuntimeError('falha simulada')]
        with self.assertRaises(RuntimeError):
            self.registrar([1, 2])
        self.conexao.rollback.assert_called_once()
        self.conexao.commit.assert_not_called()
        self.conexao.close.assert_called_once()

    def test_data_futura_rejeitada_antes_do_banco(self):
        with self.assertRaises(ValidationError):
            self.ns['PagarBoleto'](data_pagamento=date.today() + timedelta(days=1))

    def test_previsoes_nao_compartilham_checagem_de_codigo_vazio(self):
        self.cursor.fetchone.return_value = (3,)
        boleto = self.ns['BoletoCreate'](fornecedor='Oficina', valor=100, vencimento='2026-10-10', codigo_barras='', categoria='Peças')
        resultado = self.ns['criar_boleto'](boleto, Mock(), {'id': 7})
        self.assertEqual(resultado['id'], 3)
        self.assertEqual(self.cursor.execute.call_count, 1)
        self.assertIn('INSERT INTO boletos', self.cursor.execute.call_args.args[0])


if __name__ == '__main__':
    unittest.main()
