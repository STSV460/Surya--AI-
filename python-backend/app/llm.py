import os

from crewai import LLM

from app.config import get_settings


def make_llm(model: str = "anthropic/claude-sonnet-4.6") -> LLM:
    settings = get_settings()
    os.environ["OPENAI_API_KEY"] = settings.openai_api_key
    return LLM(
        model=model,
        api_base=settings.insforge_api_url,
        api_key=settings.insforge_api_key,
    )
