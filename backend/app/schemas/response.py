from typing import Any, Dict
from pydantic import BaseModel

class StandardResponse(BaseModel):
    success: bool
    message: str
    data: Any = None
    error: Optional[Dict[str, Any]] = None
