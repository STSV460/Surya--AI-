from app.tools.base import make_connector_tool


def docs_tools(cookie: str):
    return [
        make_connector_tool(cookie, "/api/connectors/docs", "docs_read", "Read Google Docs content."),
        make_connector_tool(cookie, "/api/connectors/google-docs", "docs_create", "Create Google Docs."),
    ]
