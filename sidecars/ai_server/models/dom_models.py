"""
Pydantic schemas for DOM Explainer and Playwright Generator routes.
"""
from pydantic import BaseModel


class DomExplainRequest(BaseModel):
    """Request body for POST /explain-dom"""
    html: str
    """The full outer HTML of the page or selected element to explain."""

    question: str = "Explain the structure of this page and identify any potential issues."
    """Optional custom prompt to send to Gemini alongside the HTML."""


class DomExplainResponse(BaseModel):
    """Response body for POST /explain-dom"""
    explanation: str
    """Gemini's plain-English explanation of the DOM."""


class PlaywrightEvent(BaseModel):
    """A single recorded user interaction event."""
    type: str
    """Event type: 'click' | 'input' | 'navigate' | 'scroll'"""
    selector: str = ""
    """CSS selector of the target element (empty for navigate events)."""
    value: str = ""
    """The typed text for input events, or URL for navigate events."""
    x: float = 0
    y: float = 0


class PlaywrightGenRequest(BaseModel):
    """Request body for POST /playwright"""
    events: list[PlaywrightEvent]
    language: str = "python"
    """Output language: 'python' | 'javascript'"""


class PlaywrightGenResponse(BaseModel):
    """Response body for POST /playwright"""
    script: str
    """The ready-to-run Playwright test script."""
