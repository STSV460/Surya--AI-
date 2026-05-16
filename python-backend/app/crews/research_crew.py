from app.crews.common import assemble_crew, make_agent, make_task, search_tools, text_input


def build_research_crew(inputs, cookie: str, **kwargs):
    topic = text_input(inputs)
    tools = search_tools(cookie)
    researcher = make_agent(
        "Researcher",
        "Find accurate, current, source-backed information.",
        "You search broadly, avoid weak sources, and preserve citations.",
        tools=tools,
    )
    analyst = make_agent(
        "Analyst",
        "Extract implications, contradictions, and useful structure.",
        "You turn raw findings into clear judgment.",
    )
    writer = make_agent(
        "Writer",
        "Produce a polished final answer with concise citations.",
        "You write direct, useful research briefs for Surya AI users.",
    )
    return assemble_crew(
        [researcher, analyst, writer],
        [
            make_task(f"Research this topic: {topic}", "Source-backed notes with URLs.", researcher),
            make_task("Analyze the notes and identify key conclusions.", "Structured analysis.", analyst),
            make_task("Write final answer for the user.", "Clear final response with cited sources.", writer),
        ],
        **kwargs,
    )
