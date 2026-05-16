from app.tools.calendar import calendar_tools
from app.tools.docs import docs_tools
from app.tools.drive import drive_tools
from app.tools.github import github_tools
from app.tools.gmail import gmail_tools
from app.tools.image_gen import image_gen_tools
from app.tools.memory import memory_tools
from app.tools.search import search_tools


def all_tools(cookie: str):
    return [
        *search_tools(cookie),
        *gmail_tools(cookie),
        *drive_tools(cookie),
        *calendar_tools(cookie),
        *docs_tools(cookie),
        *github_tools(cookie),
        *image_gen_tools(cookie),
        *memory_tools(cookie),
    ]
