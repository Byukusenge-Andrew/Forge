"""
dev-browser AI Sidecar
FastAPI entry point — listens on http://127.0.0.1:8765

Reads GEMINI_API_KEY from the environment (set by Electron main process at spawn time).
Users configure their key in the browser's Settings modal, which persists it via Electron IPC
and restarts this sidecar with the updated env var.
"""

import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import dom_explainer, visual_diff, playwright_gen, config as config_route


# ── Startup / shutdown lifecycle ────────────────────────────────────────────
@asynccontextmanager
async def lifespan(_app: FastAPI):
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        print("[ai-sidecar] WARNING: GEMINI_API_KEY is not set. AI endpoints will return errors.")
    else:
        print("[ai-sidecar] Gemini API key loaded ✓")
    yield
    print("[ai-sidecar] Shutting down.")


# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Dev Browser AI Sidecar",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow requests from the Electron renderer (localhost:5173 in dev, file:// in prod)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(dom_explainer.router, prefix="/explain-dom", tags=["AI"])
app.include_router(visual_diff.router,   prefix="/visual-diff", tags=["QA"])
app.include_router(playwright_gen.router,prefix="/playwright",  tags=["Automation"])
app.include_router(config_route.router,  prefix="/config",      tags=["Config"])


@app.get("/health")
def health():
    """Liveness probe called by Electron main to confirm the sidecar is ready."""
    return {"status": "ok", "gemini_configured": bool(os.environ.get("GEMINI_API_KEY"))}


if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8765, reload=False)
