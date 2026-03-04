"""
Visual Diff Route — POST /visual-diff
Compares two base64-encoded PNG screenshots using OpenCV and returns a diff image
with changed pixels highlighted in red.
"""
import base64

import cv2
import numpy as np
from fastapi import APIRouter, HTTPException
from models.diff_models import VisualDiffRequest, VisualDiffResponse

router = APIRouter()


def _b64_to_cv2(b64: str) -> np.ndarray:
    """Decode a base64 PNG string into an OpenCV BGR image array."""
    data = base64.b64decode(b64)
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image from base64 string.")
    return img


def _cv2_to_b64(img: np.ndarray) -> str:
    """Encode an OpenCV BGR image array to a base64 PNG string."""
    _, buf = cv2.imencode(".png", img)
    return base64.b64encode(buf.tobytes()).decode("utf-8")


@router.post("", response_model=VisualDiffResponse)
async def visual_diff(body: VisualDiffRequest) -> VisualDiffResponse:
    """
    Compares baseline vs current screenshots pixel-by-pixel.
    Returns a diff image (changed pixels shown in red) and statistics.

    Both images are automatically resized to match the baseline dimensions
    if they differ (e.g., due to dynamic content shifting the page height).

    Raises:
        HTTPException 422: If either image cannot be decoded.
    """
    try:
        baseline = _b64_to_cv2(body.baseline_b64)
        current  = _b64_to_cv2(body.current_b64)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    # Resize current to match baseline dimensions if needed
    if baseline.shape != current.shape:
        current = cv2.resize(current, (baseline.shape[1], baseline.shape[0]))

    # Compute per-pixel difference
    diff = cv2.absdiff(baseline, current)
    gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
    _, mask = cv2.threshold(gray, 10, 255, cv2.THRESH_BINARY)

    # Highlight changed pixels in red on a copy of the current image
    result = current.copy()
    result[mask > 0] = [0, 0, 255]  # BGR red

    changed_pixels = int(np.count_nonzero(mask))
    total_pixels   = mask.shape[0] * mask.shape[1]
    change_percent = round(changed_pixels / total_pixels * 100, 4) if total_pixels > 0 else 0.0

    return VisualDiffResponse(
        diff_b64=_cv2_to_b64(result),
        changed_pixels=changed_pixels,
        change_percent=change_percent,
    )
