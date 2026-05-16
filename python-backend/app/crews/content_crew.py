from app.crews.common import assemble_crew, docs_tools, make_agent, make_task, search_tools, text_input


def build_content_crew(inputs, cookie: str, **kwargs):
    brief = text_input(inputs)
    researcher = make_agent("Content Researcher", "Gather context for content.", "You find useful facts.", tools=search_tools(cookie))
    outliner = make_agent("Outliner", "Create strong structure.", "You plan reader-friendly content.")
    writer = make_agent("Writer", "Write polished content.", "You write in a clean Surya AI voice.", tools=docs_tools(cookie))
    editor = make_agent("Editor", "Tighten and improve final content.", "You remove fluff and sharpen clarity.")
    return assemble_crew(
        [researcher, outliner, writer, editor],
        [
            make_task(f"Research content brief: {brief}", "Research notes.", researcher),
            make_task("Create outline.", "Section outline.", outliner),
            make_task("Draft content.", "Complete draft.", writer),
            make_task("Edit final content.", "Publication-ready content.", editor),
        ],
        **kwargs,
    )
