from app.tools.base import make_connector_tool


def image_gen_tools(cookie: str):
    return [
        make_connector_tool(cookie, "/api/image-gen", "image_generate", "Generate an image artifact."),
    ]
