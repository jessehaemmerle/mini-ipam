from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "mini-ipam"
    env: str = "dev"
    database_url: str = "sqlite:///./miniipam.db"
    sqlite_dev_mode: bool = True
    secret_key: str = Field(default="change-me", min_length=8)
    algorithm: str = "HS256"
    token_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    admin_user: str = "admin"
    admin_pass: str = "admin"
    cookie_secure: bool = False
    upload_dir: str = "./uploads"


settings = Settings()

