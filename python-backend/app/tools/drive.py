from app.tools.base import make_connector_tool


def drive_tools(cookie: str):
    return [
        make_connector_tool(cookie, "/api/connectors/drive", "drive_list", "List Google Drive files."),
        make_connector_tool(cookie, "/api/connectors/drive", "drive_read", "Read Google Drive file content."),
    ]
