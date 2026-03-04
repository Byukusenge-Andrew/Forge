"""
Pydantic schemas for the Visual Diff route.
Images are transmitted as base64-encoded PNG strings to avoid file I/O dependencies.
"""
from pydantic import BaseModel


class VisualDiffRequest(BaseModel):
    """Request body for POST /visual-diff"""
    baseline_b64: str
    """Base64-encoded PNG of the baseline (reference) screenshot."""
    current_b64: str
    """Base64-encoded PNG of the current screenshot to compare against."""


class VisualDiffResponse(BaseModel):
    """Response body for POST /visual-diff"""
    diff_b64: str
    """Base64-encoded PNG of the diff image — changed pixels highlighted in red."""
    changed_pixels: int
    """Total number of pixels that changed between baseline and current."""
    change_percent: float
    """Percentage of total pixels that changed (0.0 – 100.0)."""
