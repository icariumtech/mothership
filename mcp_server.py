"""
FastMCP HTTP server for the Mothership GM campaign AI.

Exposes five tools at http://<host>:8001/mcp/ over HTTP transport.
Delegates all logic to the Django REST API at DJANGO_BASE_URL.

This module is standalone — it does NOT import Django or manage.py.
Runtime dependencies: fastmcp, httpx (see requirements.txt).

INTENTIONALLY UNAUTHENTICATED: Trust-network model (D-09). The MCP service
runs on the same homelab Docker network as the Django app. Do not expose
port 8001 to the public internet.
"""

import os

import httpx
from fastmcp import FastMCP

DJANGO_BASE_URL = os.environ.get("DJANGO_BASE_URL", "http://app:8000")

mcp = FastMCP("MothershipGM")


@mcp.tool
async def get_session_context() -> dict:
    """Return current game state snapshot: active encounter, tokens, room visibility, ship status, NPC list."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{DJANGO_BASE_URL}/api/gm/session-context")
        r.raise_for_status()
        return r.json()


@mcp.tool
async def list_files(dir: str) -> list:
    """List files in a data directory. dir is relative to data/ (e.g. 'campaign/crew')."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{DJANGO_BASE_URL}/api/gm/data/", params={"dir": dir})
        r.raise_for_status()
        return r.json()


@mcp.tool
async def read_file(path: str) -> str:
    """Read raw YAML content of a campaign file. path is relative to data/ (e.g. 'campaign/ship/ship.yaml')."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{DJANGO_BASE_URL}/api/gm/data/{path}")
        r.raise_for_status()
        return r.text


@mcp.tool
async def write_file(path: str, content: str) -> dict:
    """Write YAML content to a campaign file. Triggers SSE broadcast to player terminals. content must be valid YAML."""
    async with httpx.AsyncClient() as client:
        r = await client.put(
            f"{DJANGO_BASE_URL}/api/gm/data/{path}",
            content=content,
            headers={"Content-Type": "application/x-yaml"},
        )
        r.raise_for_status()
        return r.json()


@mcp.tool
async def get_data_schema() -> str:
    """Return the DATA_DIRECTORY_GUIDE summary so the AI understands the campaign file structure and what files exist."""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{DJANGO_BASE_URL}/api/gm/data-schema")
        r.raise_for_status()
        return r.text


if __name__ == "__main__":
    mcp.run(transport="http", host="0.0.0.0", port=8001)
