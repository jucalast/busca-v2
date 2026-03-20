# Define all pydantic models for incoming requests here.
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

# =======================
# Search Endpoints Macros
# =======================
class SearchRequest(BaseModel):
    query: str
    maxResults: Optional[int] = 8
    maxPages: Optional[int] = 3
    maxSentences: Optional[int] = 5
    region: Optional[str] = "br-pt"
    businessMode: Optional[bool] = False
    noGroq: Optional[bool] = False
    verbose: Optional[bool] = False
    modelProvider: Optional[str] = "groq"

# =======================
# Growth / Orchestrator Macros
# =======================

class BaseGrowthRequest(BaseModel):
    aiModel: Optional[str] = "groq"
    user_id: Optional[str] = "default_user"
    business_id: Optional[str] = None
    profile: Optional[Dict[str, Any]] = None

class ActionProfileRequest(BaseGrowthRequest):
    onboardingData: Dict[str, Any]

class ActionAnalyzeRequest(BaseGrowthRequest):
    region: Optional[str] = "br-pt"

class ActionAssistRequest(BaseGrowthRequest):
    task: Dict[str, Any]

class ActionChatRequest(BaseGrowthRequest):
    messages: List[Dict[str, Any]] = []
    user_message: str = ""
    extracted_profile: Optional[Dict[str, Any]] = {}

class ActionDimensionChatRequest(BaseGrowthRequest):
    dimension: str
    userMessage: str
    messages: List[Dict[str, Any]] = []
    context: Optional[Dict[str, Any]] = {}

# Specialist actions schemas
class ActionSpecialistPlanRequest(BaseGrowthRequest):
    analysis_id: str
    pillar_key: str

class ActionSpecialistExecuteRequest(BaseGrowthRequest):
    analysis_id: str
    pillar_key: str
    task_id: str
    task_data: Dict[str, Any]

class ActionExpandSubtasksRequest(BaseGrowthRequest):
    analysis_id: str
    pillar_key: str
    task_data: Dict[str, Any]

class ActionAITryUserTaskRequest(BaseModel):
    analysis_id: str
    pillar_key: str
    task_data: dict
    profile: dict
    aiModel: Optional[str] = "groq"

class ActionExecuteAllSubtasksRequest(BaseModel):
    analysis_id: str
    pillar_key: str
    task_id: str
    task_data: dict
    profile: dict
    aiModel: Optional[str] = "groq"

class ActionPollBackgroundStatusRequest(BaseModel):
    analysis_id: str
    task_id: str
    pillar_key: Optional[str] = None

class ActionRedoSubtasksRequest(BaseModel):
    analysis_id: str
    pillar_key: str
    task_id: str

class ActionRedoTaskRequest(BaseModel):
    analysis_id: str
    pillar_key: str
    task_id: str

class ActionRedoPillarRequest(BaseModel):
    analysis_id: str
    pillar_key: str

class ActionCheckExecutionStatusRequest(BaseModel):
    analysis_id: str

# Auth actions schemas
class ActionRegisterRequest(BaseGrowthRequest):
    email: str
    password: str
    name: Optional[str] = None

class ActionLoginRequest(BaseGrowthRequest):
    email: str
    password: str

class ActionLogoutRequest(BaseGrowthRequest):
    token: Optional[str] = None

class ActionValidateSessionRequest(BaseGrowthRequest):
    token: str

# Typed schemas for endpoints that previously used dict
class PillarStateRequest(BaseModel):
    analysis_id: str
    pillar_key: str

class AnalysisTasksRequest(BaseModel):
    analysis_id: str
    pillar_key: str

class DeleteBusinessRequest(BaseModel):
    business_id: str

class ProductionAgentRequest(BaseModel):
    analysis_id: str
    pillar_key: str
    aiModel: Optional[str] = "groq"

