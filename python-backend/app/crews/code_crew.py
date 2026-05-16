from app.crews.common import assemble_crew, github_tools, make_agent, make_task, text_input


def build_code_crew(inputs, cookie: str, **kwargs):
    request = text_input(inputs)
    tools = github_tools(cookie)
    architect = make_agent("Software Architect", "Design safe implementation approach.", "You understand systems deeply.", tools=tools)
    coder = make_agent("Coder", "Produce practical code guidance.", "You write production-minded code.")
    reviewer = make_agent("Reviewer", "Find bugs and missing tests.", "You review for correctness and regressions.")
    return assemble_crew(
        [architect, coder, reviewer],
        [
            make_task(f"Design solution for: {request}", "Implementation plan.", architect),
            make_task("Write code-oriented answer.", "Code and explanation.", coder),
            make_task("Review final answer for risks.", "Reviewed final answer.", reviewer),
        ],
        **kwargs,
    )
