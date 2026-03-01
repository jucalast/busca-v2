"""
Vector Memory Service 100% Local usando ChromaDB.
Funciona como SQLite: cria pasta local e persiste tudo lá.
"""

import os
import json
import hashlib
import sys
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime

try:
    import chromadb
    from chromadb.config import Settings
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False
    print("⚠️ ChromaDB não instalado. Use: pip install chromadb", file=sys.stderr)


class LocalVectorStore:
    """
    Armazenamento vetorial 100% local usando ChromaDB.
    Cria pasta data/vector_db/ igual ao SQLite.
    """
    
    def __init__(self, collection_name: str = "pillar_memory"):
        if not CHROMA_AVAILABLE:
            raise ImportError("ChromaDB não disponível. Instale com: pip install chromadb")
        
        # Criar diretório data/vector_db/ igual ao SQLite
        vector_db_dir = Path(__file__).parent.parent.parent.parent.parent / 'data' / 'vector_db'
        vector_db_dir.mkdir(parents=True, exist_ok=True)
        
        # Inicializar cliente persistente
        self.client = chromadb.PersistentClient(
            path=str(vector_db_dir),
            settings=Settings(
                anonymized_telemetry=False,
                allow_reset=False
            )
        )
        
        # Criar/get coleção
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            metadata={"description": "Pillar agent memory and knowledge"}
        )
    
    def add_knowledge(self, documents: List[str], metadatas: List[Dict[str, Any]], ids: List[str]) -> bool:
        """
        Adiciona conhecimento à memória vetorial.
        
        Args:
            documents: Textos para armazenar
            metadatas: Metadados (industria, tipo, etc)
            ids: IDs únicos
        
        Returns:
            True se sucesso
        """
        try:
            self.collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            return True
        except Exception as e:
            print(f"❌ Erro ao adicionar conhecimento: {str(e)}", file=sys.stderr)
            return False
    
    def search_knowledge(self, query: str, n_results: int = 5, filter_metadata: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Busca conhecimento relevante.
        
        Args:
            query: Query de busca
            n_results: Número de resultados
            filter_metadata: Filtro de metadados
        
        Returns:
            Lista de resultados com documentos, metadados e scores
        """
        try:
            # ChromaDB não suporta filtros complexos em queries, vamos buscar tudo e filtrar
            results = self.collection.query(
                query_texts=[query],
                n_results=n_results * 2  # Buscar mais para filtrar depois
            )
            
            formatted_results = []
            for i, (docs, metadatas, distances) in enumerate(zip(
                results["documents"][0], 
                results["metadatas"][0], 
                results["distances"][0]
            )):
                # Aplicar filtro manual se fornecido
                if filter_metadata:
                    match = True
                    for key, value in filter_metadata.items():
                        if metadatas.get(key) != value:
                            match = False
                            break
                    if not match:
                        continue
                
                formatted_results.append({
                    "document": docs,
                    "metadata": metadatas,
                    "similarity_score": 1 - distances,  # Chroma usa distância, converter para similaridade
                    "rank": i + 1
                })
                
                # Limitar resultados
                if len(formatted_results) >= n_results:
                    break
            
            return formatted_results
            
        except Exception as e:
            print(f"❌ Erro na busca vetorial: {str(e)}", file=sys.stderr)
            return []
    
    def get_by_industry(self, industry: str, knowledge_type: str = None) -> List[Dict[str, Any]]:
        """
        Busca conhecimento por indústria.
        
        Args:
            industry: Nome da indústria
            knowledge_type: Tipo de conhecimento (objecoes, estrategias, etc)
        
        Returns:
            Lista de resultados
        """
        filter_dict = {"industria": industry}
        if knowledge_type:
            filter_dict["tipo"] = knowledge_type
        
        return self.search_knowledge(
            query=f"conhecimento sobre {industry}",
            filter_metadata=filter_dict
        )
    
    def store_objection(self, industry: str, objection: str, response: str, effectiveness_score: float = 0.8) -> bool:
        """
        Armazena objeção e resposta para aprendizado futuro.
        
        Args:
            industry: Indústria
            objection: Objeção do cliente
            response: Resposta eficaz
            effectiveness_score: Score de eficácia (0-1)
        
        Returns:
            True se sucesso
        """
        # Criar ID único
        content = f"{industry}:{objection}:{response}"
        doc_id = hashlib.md5(content.encode()).hexdigest()
        
        document = f"Objeção: {objection}\nResposta: {response}"
        metadata = {
            "industria": industry,
            "tipo": "quebra_objecao",
            "objecao": objection,
            "resposta": response,
            "effectiveness_score": effectiveness_score,
            "created_at": str(datetime.now())
        }
        
        return self.add_knowledge([document], [metadata], [doc_id])
    
    def store_competitor_insight(self, industry: str, competitor: str, insight: str, source_url: str = "") -> bool:
        """
        Armazena insight sobre concorrente.
        
        Args:
            industry: Indústria
            competitor: Nome do concorrente
            insight: Insight estratégico
            source_url: URL fonte
        
        Returns:
            True se sucesso
        """
        content = f"{industry}:{competitor}:{insight}"
        doc_id = hashlib.md5(content.encode()).hexdigest()
        
        document = f"Concorrente: {competitor}\nInsight: {insight}"
        metadata = {
            "industria": industry,
            "tipo": "competitor_insight",
            "competitor": competitor,
            "insight": insight,
            "source_url": source_url,
            "created_at": str(datetime.now())
        }
        
        return self.add_knowledge([document], [metadata], [doc_id])
    
    def get_best_objections_responses(self, industry: str, objection_pattern: str) -> List[Dict[str, Any]]:
        """
        Busca melhores respostas para objeções específicas.
        
        Args:
            industry: Indústria
            objection_pattern: Padrão da objeção
        
        Returns:
            Lista de respostas ordenadas por eficácia
        """
        results = self.search_knowledge(
            query=f"objecao {objection_pattern} resposta",
            filter_metadata={
                "industria": industry,
                "tipo": "quebra_objecao"
            }
        )
        
        # Ordenar por effectiveness_score
        results.sort(key=lambda x: x["metadata"].get("effectiveness_score", 0), reverse=True)
        return results
    
    def get_competitor_weaknesses(self, industry: str) -> List[Dict[str, Any]]:
        """
        Busca vulnerabilidades de concorrentes.
        
        Args:
            industry: Indústria
        
        Returns:
            Lista de vulnerabilidades
        """
        results = self.search_knowledge(
            query="vulnerabilidade fraqueza concorrente",
            filter_metadata={
                "industria": industry,
                "tipo": "competitor_insight"
            }
        )
        
        return results
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Retorna estatísticas da memória vetorial.
        
        Returns:
            Estatísticas de uso
        """
        try:
            count = self.collection.count()
            
            # Buscar tipos de conhecimento
            all_results = self.collection.get()
            metadata_list = all_results.get("metadatas", [])
            
            stats = {
                "total_documents": count,
                "industries": set(),
                "knowledge_types": set(),
                "last_updated": str(datetime.now())
            }
            
            for metadata in metadata_list:
                if "industria" in metadata:
                    stats["industries"].add(metadata["industria"])
                if "tipo" in metadata:
                    stats["knowledge_types"].add(metadata["tipo"])
            
            stats["industries"] = list(stats["industries"])
            stats["knowledge_types"] = list(stats["knowledge_types"])
            
            return stats
            
        except Exception as e:
            print(f"❌ Erro ao obter estatísticas: {str(e)}", file=sys.stderr)
            return {}


# Instância global para uso em toda aplicação
_vector_store = None

def get_vector_store(collection_name: str = "pillar_memory") -> LocalVectorStore:
    """
    Retorna instância do vector store (singleton pattern).
    
    Args:
        collection_name: Nome da coleção
    
    Returns:
        Instância do LocalVectorStore
    """
    global _vector_store
    if _vector_store is None:
        _vector_store = LocalVectorStore(collection_name)
    return _vector_store


# Funções de conveniência para uso nos pilares
def store_objection_learning(industry: str, objection: str, response: str, effectiveness: float = 0.8) -> bool:
    """Armazena aprendizado de objeção."""
    store = get_vector_store()
    return store.store_objection(industry, objection, response, effectiveness)


def get_objection_responses(industry: str, objection: str) -> List[Dict[str, Any]]:
    """Busca respostas para objeções."""
    store = get_vector_store()
    return store.get_best_objections_responses(industry, objection)


def store_competitor_analysis(industry: str, competitor: str, insight: str, source: str = "") -> bool:
    """Armazena análise de concorrente."""
    store = get_vector_store()
    return store.store_competitor_insight(industry, competitor, insight, source)


def get_competitor_intelligence(industry: str) -> List[Dict[str, Any]]:
    """Busca inteligência sobre concorrentes."""
    store = get_vector_store()
    return store.get_competitor_weaknesses(industry)
