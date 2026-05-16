from __future__ import annotations

from typing import Any, Type

import httpx
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from app.config import get_settings


class ConnectorArgs(BaseModel):
    action: str = Field(..., description="Connector operation name")
    payload: dict[str, Any] = Field(default_factory=dict, description="Connector request payload")


class SuryaConnectorTool(BaseTool):
    name: str = "surya_connector"
    description: str = "Call a Surya connector endpoint with the authenticated user session."
    args_schema: Type[BaseModel] = ConnectorArgs
    route: str = "/api/connectors/search"
    cookie: str = ""

    def __init__(self, *, cookie: str, route: str | None = None, name: str | None = None, description: str | None = None) -> None:
        super().__init__()
        self.cookie = cookie
        if route is not None:
            self.route = route
        if name is not None:
            self.name = name
        if description is not None:
            self.description = description

    def _run(self, action: str, payload: dict[str, Any] | None = None) -> str:
        settings = get_settings()
        url = f"{settings.app_base_url}{self.route}"
        body = {"action": action, **(payload or {})}
        with httpx.Client(timeout=60.0) as client:
            res = client.post(
                url,
                headers={"Cookie": self.cookie, "Content-Type": "application/json"},
                json=body,
            )
        if res.status_code >= 400:
            return f"Connector error {res.status_code}: {res.text[:2000]}"
        return res.text[:12000]


def make_connector_tool(cookie: str, route: str, name: str, description: str) -> SuryaConnectorTool:
    return SuryaConnectorTool(cookie=cookie, route=route, name=name, description=description)
