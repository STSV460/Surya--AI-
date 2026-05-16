from functools import lru_cache

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    insforge_api_key: str = Field(alias="INSFORGE_API_KEY")
    insforge_api_url: str = Field(alias="INSFORGE_API_URL")
    surya_base_url: AnyHttpUrl = Field(alias="SURYA_BASE_URL")
    supabase_db_url: str = Field(alias="SUPABASE_DB_URL")
    nextauth_url: AnyHttpUrl | None = Field(default=None, alias="NEXTAUTH_URL")
    openai_api_key: str = Field(default="sk-dummy", alias="OPENAI_API_KEY")

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def app_base_url(self) -> str:
        return str(self.surya_base_url).rstrip("/")

    @property
    def auth_base_url(self) -> str:
        return str(self.nextauth_url or self.surya_base_url).rstrip("/")


@lru_cache
def get_settings() -> Settings:
    return Settings()
