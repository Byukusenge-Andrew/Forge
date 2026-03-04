"""
Playwright Script Generator — POST /playwright
Converts a list of recorded user interaction events into a runnable Playwright test script.
Supports Python and JavaScript output.
"""
from fastapi import APIRouter
from models.dom_models import PlaywrightGenRequest, PlaywrightGenResponse

router = APIRouter()


def _generate_python(events: list) -> str:
    """Build a Python Playwright script from the event list."""
    lines = [
        "from playwright.sync_api import sync_playwright",
        "",
        "def run(playwright):",
        "    browser = playwright.chromium.launch(headless=False)",
        "    page = browser.new_page()",
        "",
    ]
    for ev in events:
        if ev.type == "navigate":
            lines.append(f'    page.goto("{ev.value}")')
        elif ev.type == "click":
            sel = ev.selector or f'[data-x="{ev.x}"][data-y="{ev.y}"]'
            lines.append(f'    page.click("{sel}")')
        elif ev.type == "input":
            lines.append(f'    page.fill("{ev.selector}", "{ev.value}")')
        elif ev.type == "scroll":
            lines.append(f'    page.mouse.wheel({ev.x}, {ev.y})')

    lines += [
        "",
        "    browser.close()",
        "",
        "with sync_playwright() as p:",
        "    run(p)",
    ]
    return "\n".join(lines)


def _generate_javascript(events: list) -> str:
    """Build a JavaScript Playwright script from the event list."""
    lines = [
        "const { chromium } = require('playwright');",
        "",
        "(async () => {",
        "  const browser = await chromium.launch({ headless: false });",
        "  const page = await browser.newPage();",
        "",
    ]
    for ev in events:
        if ev.type == "navigate":
            lines.append(f'  await page.goto("{ev.value}");')
        elif ev.type == "click":
            sel = ev.selector or f'[data-x="{ev.x}"]'
            lines.append(f'  await page.click("{sel}");')
        elif ev.type == "input":
            lines.append(f'  await page.fill("{ev.selector}", "{ev.value}");')
        elif ev.type == "scroll":
            lines.append(f'  await page.mouse.wheel({ev.x}, {ev.y});')

    lines += [
        "",
        "  await browser.close();",
        "})();",
    ]
    return "\n".join(lines)


@router.post("", response_model=PlaywrightGenResponse)
async def generate_script(body: PlaywrightGenRequest) -> PlaywrightGenResponse:
    """
    Converts a stream of recorded browser events into a Playwright script.
    Supports 'python' and 'javascript' output languages.
    """
    if body.language == "javascript":
        script = _generate_javascript(body.events)
    else:
        script = _generate_python(body.events)

    return PlaywrightGenResponse(script=script)
