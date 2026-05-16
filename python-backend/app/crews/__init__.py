from app.crews.content_crew import build_content_crew
from app.crews.code_crew import build_code_crew
from app.crews.custom import build_custom_crew
from app.crews.email_crew import build_email_crew
from app.crews.planner_crew import build_planner_crew
from app.crews.research_crew import build_research_crew


BUILDERS = {
    "research": build_research_crew,
    "email": build_email_crew,
    "content": build_content_crew,
    "code": build_code_crew,
    "planner": build_planner_crew,
    "custom": build_custom_crew,
}
