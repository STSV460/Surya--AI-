from app.tools.base import make_connector_tool


def memory_tools(cookie: str):
    return [
        make_connector_tool(cookie, "/api/memory", "save_memory", "Save persistent user memory."),
        make_connector_tool(cookie, "/api/memory", "recall_memory", "Recall persistent user memory."),
    ]
