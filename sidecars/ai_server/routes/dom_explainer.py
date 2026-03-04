"""
DOM Explainer Route — POST /explain-dom
Sends a page's HTML to the Gemini API and returns a plain-English structural explanation.
"""
import os

from fastapi import APIRouter, HTTPException
from models.dom_models import DomExplainRequest, DomExplainResponse

router = APIRouter()


@router.post("", response_model=DomExplainResponse)
async def explain_dom(body: DomExplainRequest) -> DomExplainResponse:
    """
    Accepts a DOM HTML string and an optional question, sends it to Gemini,
    and returns a plain-English explanation.

    Raises:
        HTTPException 503: If GEMINI_API_KEY is not configured by the user.
        HTTPException 502: If the Gemini API call fails.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Gemini API key is not configured. Open ⚙️ Settings in the browser to add your key."
        )

    try:
        import google.generativeai as genai  # lazy import — only required when key is set
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        # Truncate HTML to avoid exceeding token limits (keep first 15k chars)
        html_snippet = body.html[:15_000]

        prompt = f"""{body.question}

Here is the HTML of the page:

```html
{html_snippet}
```

Provide a clear, concise explanation. Identify:
1. The overall page structure and layout approach.
2. Key sections (header, nav, main content, footer).
3. Any accessibility issues (missing alt text, ARIA labels, heading hierarchy).
4. Any suspicious or overly complex nesting.
"""
        response = model.generate_content(prompt)
        return DomExplainResponse(explanation=response.text)

    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini API error: {exc}") from exc
