from app.tools.base import make_connector_tool


def gmail_tools(cookie: str):
    return [
        make_connector_tool(cookie, "/api/connectors/gmail", "gmail_search", "Search Gmail messages."),
        make_connector_tool(cookie, "/api/connectors/gmail", "gmail_read", "Read Gmail message details."),
        make_connector_tool(cookie, "/api/connectors/gmail", "gmail_send", "Draft or send Gmail messages."),
    ]
