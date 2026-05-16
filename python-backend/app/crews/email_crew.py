from app.crews.common import assemble_crew, gmail_tools, make_agent, make_task, text_input


def build_email_crew(inputs, cookie: str, **kwargs):
    request = text_input(inputs)
    tools = gmail_tools(cookie)
    drafter = make_agent("Email Drafter", "Draft useful email content.", "You write crisp email drafts.", tools=tools)
    reviewer = make_agent("Email Reviewer", "Check tone and correctness.", "You catch ambiguity before sending.")
    sender = make_agent("Email Sender", "Prepare final Gmail action.", "You only send when explicitly requested.", tools=tools)
    return assemble_crew(
        [drafter, reviewer, sender],
        [
            make_task(f"Handle this email request: {request}", "Draft or findings from Gmail.", drafter),
            make_task("Review draft for tone, missing context, and risk.", "Reviewed draft.", reviewer),
            make_task("Prepare final output or Gmail action.", "Final email result.", sender),
        ],
        **kwargs,
    )
