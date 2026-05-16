from __future__ import annotations

from typing import Any

from crewai import Agent, Crew, Process, Task

from app.llm import make_llm
from app.tools import all_tools, docs_tools, github_tools, gmail_tools, search_tools


def text_input(inputs: dict[str, Any]) -> str:
    return str(inputs.get("message") or inputs.get("topic") or inputs.get("prompt") or inputs)


def make_agent(role: str, goal: str, backstory: str, tools=None, model: str | None = None) -> Agent:
    return Agent(
        role=role,
        goal=goal,
        backstory=backstory,
        tools=tools or [],
        llm=make_llm(model or "anthropic/claude-sonnet-4.6"),
        verbose=True,
        reasoning=True,
        max_reasoning_attempts=3,
        allow_delegation=False,
    )


def make_task(description: str, expected_output: str, agent: Agent) -> Task:
    return Task(description=description, expected_output=expected_output, agent=agent)


def assemble_crew(agents: list[Agent], tasks: list[Task], process: Process = Process.sequential, **kwargs: Any) -> Crew:
    return Crew(
        agents=agents,
        tasks=tasks,
        process=process,
        verbose=True,
        planning=True,
        planning_llm=make_llm("anthropic/claude-sonnet-4.6"),
        **kwargs,
    )


__all__ = [
    "Agent",
    "Crew",
    "Process",
    "Task",
    "all_tools",
    "assemble_crew",
    "docs_tools",
    "github_tools",
    "gmail_tools",
    "make_agent",
    "make_task",
    "search_tools",
    "text_input",
]
