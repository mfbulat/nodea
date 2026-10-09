from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://mindmap:mindmap@db:5432/mindmap"
    jwt_secret: str = "change-me"
    access_ttl_minutes: int = 15
    refresh_ttl_days: int = 30
    cookie_secure: bool = False
    s3_endpoint: str = "http://minio:9000"
    s3_public_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "mindmap"
    # Автоснимок версии не чаще, чем раз в N секунд при автосохранении
    version_interval_seconds: int = 300


settings = Settings()
