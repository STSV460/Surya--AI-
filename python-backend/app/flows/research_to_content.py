from __future__ import annotations

from app.crews.content_crew import build_content_crew
from app.crews.research_crew import build_research_crew


async def build_research_to_content(topic: str, cookie: str):
    research = build_research_crew({"topic": topic}, cookie)
    content = build_content_crew({"topic": topic}, cookie)
    return research, content
