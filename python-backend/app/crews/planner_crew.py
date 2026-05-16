from app.crews.common import Process, assemble_crew, make_agent, make_task, text_input


def build_planner_crew(inputs, cookie: str, **kwargs):
    request = text_input(inputs)
    manager = make_agent(
        "Project Manager",
        "Coordinate a practical execution plan.",
        "You decompose work into ordered, measurable steps.",
        model="anthropic/claude-opus-4.6",
    )
    researcher = make_agent("Planner Researcher", "Identify constraints.", "You find hidden dependencies.")
    strategist = make_agent("Strategist", "Choose best sequence.", "You optimize for speed and correctness.")
    return assemble_crew(
        [manager, researcher, strategist],
        [
            make_task(f"Plan this request: {request}", "Risk-aware plan.", manager),
            make_task("Identify constraints and dependencies.", "Constraints list.", researcher),
            make_task("Create final execution plan.", "Ordered execution plan.", strategist),
        ],
        process=Process.sequential,
        **kwargs,
    )
