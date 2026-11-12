import json
from typing import Union, Dict, Any
from .models import ProtocolMessage

def serialize_message(message: Union[ProtocolMessage, Dict[str, Any]]) -> str:
    """
    Serializes a ProtocolMessage or dictionary into a compact JSON string without formatting spaces.
    Does NOT include trailing newline; caller should write line breaks explicitly.
    """
    if isinstance(message, ProtocolMessage):
        data = message.to_dict()
    else:
        data = message

    return json.dumps(data, separators=(",", ":"), ensure_ascii=False)

