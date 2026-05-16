from app.tools.base import make_connector_tool


def github_tools(cookie: str):
    return [
        make_connector_tool(cookie, "/api/connectors/github", "github_repos", "List GitHub repositories."),
        make_connector_tool(cookie, "/api/connectors/github", "github_issues", "List GitHub issues."),
        make_connector_tool(cookie, "/api/connectors/github", "github_create_issue", "Create GitHub issues."),
    ]
