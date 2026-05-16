from app.tools.base import make_connector_tool


def calendar_tools(cookie: str):
    return [
        make_connector_tool(cookie, "/api/connectors/calendar", "calendar_list_events", "List calendar events."),
        make_connector_tool(cookie, "/api/connectors/calendar", "calendar_create_event", "Create calendar events."),
    ]
