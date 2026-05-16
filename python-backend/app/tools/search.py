from app.tools.base import make_connector_tool


def search_tools(cookie: str):
    return [
        make_connector_tool(cookie, "/api/connectors/search", "web_search", "Search the web."),
        make_connector_tool(cookie, "/api/connectors/search", "web_scrape", "Read a web page."),
    ]
