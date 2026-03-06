"""
Test configuration — shared fixtures for all tests.
"""
import os
import sys
import pytest
import tempfile
from pathlib import Path

# Ensure the app module is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent.parent / '.env')


@pytest.fixture(autouse=True)
def temp_database():
    """Use the connected PostgreSQL instance. Tests must handle their own cleanup or run adjacently."""
    
    # Make sure to run init_db
    from app.core.database import init_db
    try:
        init_db()
    except Exception as e:
        print(f"Warning: init_db failed {e}")
    
    yield


@pytest.fixture
def sample_profile():
    """A realistic business profile for testing."""
    return {
        "perfil": {
            "nome_negocio": "Troty Brownies",
            "segmento": "confeitaria artesanal",
            "modelo_negocio": "B2C",
            "localizacao": "Indaiatuba - SP",
            "num_funcionarios": "2",
            "faturamento_mensal": "R$ 5.000",
            "ticket_medio": "R$ 25",
            "diferencial": "receita família, brownies belgas",
            "canais_venda": "Instagram, venda na rua",
            "dificuldades": "atrair clientes online",
        }
    }
