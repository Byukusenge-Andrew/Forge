"""
Config Route — POST /config
Allows the Electron main process to hot-reload the Gemini API key without restarting
the sidecar. The key is applied to os.environ immediately.
"""
import os

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class ConfigUpdate(BaseModel):
    gemini_api_key: str


class ConfigResponse(BaseModel):
    ok: bool
    message: str


@router.post("", response_model=ConfigResponse)
async def update_config(body: ConfigUpdate) -> ConfigResponse:
    """
    Hot-reload the Gemini API key.
    Called by Electron whenever the user saves a new key in the Settings modal.
    """
    if not body.gemini_api_key.strip():
        return ConfigResponse(ok=False, message="API key cannot be empty.")

    os.environ["GEMINI_API_KEY"] = body.gemini_api_key.strip()
    print(f"[ai-sidecar] Gemini API key updated (length={len(body.gemini_api_key)})")
    return ConfigResponse(ok=True, message="API key updated successfully.")
