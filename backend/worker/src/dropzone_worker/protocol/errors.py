class ProtocolErrorCode:
    MALFORMED_JSON = "MALFORMED_JSON"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNKNOWN_COMMAND = "UNKNOWN_COMMAND"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    TIMEOUT = "TIMEOUT"
    SHUTTING_DOWN = "SHUTTING_DOWN"

    # Media Extraction & Analysis Error Codes (Milestone 3)
    INVALID_URL = "INVALID_URL"
    UNSUPPORTED_URL = "UNSUPPORTED_URL"
    EXTRACTION_FAILED = "EXTRACTION_FAILED"
    NETWORK_ERROR = "NETWORK_ERROR"
    NETWORK_TIMEOUT = "NETWORK_TIMEOUT"
    GEO_RESTRICTED = "GEO_RESTRICTED"
    PRIVATE_CONTENT = "PRIVATE_CONTENT"
    AUTH_REQUIRED = "AUTH_REQUIRED"
    RATE_LIMITED = "RATE_LIMITED"
    EXTRACTOR_UNAVAILABLE = "EXTRACTOR_UNAVAILABLE"
    ENGINE_UNAVAILABLE = "ENGINE_UNAVAILABLE"
    ANALYSIS_TIMEOUT = "ANALYSIS_TIMEOUT"
    UNKNOWN_ERROR = "UNKNOWN_ERROR"

class WorkerProtocolError(Exception):
    def __init__(self, code: str, message: str, details: dict = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}

    def to_dict(self) -> dict:
        result = {"code": self.code, "message": self.message}
        if self.details:
            result["details"] = self.details
        return result
