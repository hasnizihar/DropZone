class ProtocolErrorCode:
    MALFORMED_JSON = "MALFORMED_JSON"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNKNOWN_COMMAND = "UNKNOWN_COMMAND"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    TIMEOUT = "TIMEOUT"
    SHUTTING_DOWN = "SHUTTING_DOWN"

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
