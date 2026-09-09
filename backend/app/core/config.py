from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "AI Classroom Monitor"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    SECRET_KEY: str = "dev-super-secret-key-attentionsys-classroom-2025"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    DATABASE_URL: str = ""
    
    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        if not self.DATABASE_URL:
            return ""
        # Supabase provides postgresql:// but SQLAlchemy 2.0+ with psycopg requires postgresql+psycopg://
        uri = self.DATABASE_URL
        if uri.startswith("postgresql://"):
            uri = uri.replace("postgresql://", "postgresql+psycopg://", 1)
        return uri
    
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
