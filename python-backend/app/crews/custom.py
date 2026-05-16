from __future__ import annotations

from typing import Any

from app.crews.common import Process, assemble_crew, make_agent, make_task
from app.tools import all_tools


def build_custom_crew(inputs: dict[str, Any], cookie: str, template: dict[str, Any] | None = None, **kwargs):
    if not template:
        raise ValueError("Custom crew requires template")

    available_tools = all_tools(cookie)
    agents_by_name = {}
    agents = []
    for spec in template.get("agents", []):
        tool_names = set(spec.get("tools", []))
        selected_tools = [tool for tool in available_tools if tool.name in tool_names] if tool_names else []
        agent = make_agent(
            spec.get("role", "Agent"),
            spec.get("goal", "Complete assigned task."),
            spec.get("backstory", "A capable Surya AI crew agent."),
            tools=selected_tools,
            model=spec.get("model"),
        )
        agents_by_name[spec.get("id") or spec.get("role") or f"agent-{len(agents)}"] = agent
        agents.append(agent)

    tasks = []
    for spec in template.get("tasks", []):
        agent = agents_by_name.get(spec.get("agentId")) or agents[0]
        tasks.append(
            make_task(
                spec.get("description", "Complete the task.") + f"\n\nUser inputs: {inputs}",
                spec.get("expectedOutput", "Useful final output."),
                agent,
            )
        )

    process = Process.hierarchical if template.get("process") == "hierarchical" else Process.sequential
    return assemble_crew(agents, tasks, process=process, **kwargs)
