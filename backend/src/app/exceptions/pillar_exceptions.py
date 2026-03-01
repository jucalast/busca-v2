"""
Custom exceptions for pillar operations.
Provides specific error types for better error handling and debugging.
"""


class PillarException(Exception):
    """Base exception for all pillar-related errors."""
    pass


class ContextExtractionError(PillarException):
    """Raised when context extraction fails."""
    pass


class SchemaValidationError(PillarException):
    """Raised when schema validation fails."""
    pass


class PillarExecutionError(PillarException):
    """Raised when pillar execution fails."""
    pass


class ResearchError(PillarException):
    """Raised when web research fails."""
    pass


class LLMServiceError(PillarException):
    """Raised when LLM service fails."""
    pass


class DatabaseError(PillarException):
    """Raised when database operations fail."""
    pass


class ConfigurationError(PillarException):
    """Raised when pillar configuration is invalid."""
    pass


class ScopeViolationError(PillarException):
    """Raised when a pillar tries to operate outside its defined scope."""
    pass
