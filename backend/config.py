"""Application configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Central configuration store. All values come from the .env file
    or OS-level environment variables — nothing is hard-coded."""

    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o")

    CLOUDFUZE_BASE_URL: str = os.getenv("CLOUDFUZE_BASE_URL", "http://localhost:8080")
    CLOUDFUZE_TOKEN: str = os.getenv("CLOUDFUZE_TOKEN", "")

    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")

    DEBUG: bool = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    API_REQUEST_TIMEOUT: int = int(os.getenv("API_REQUEST_TIMEOUT", "30"))
    API_MAX_RETRIES: int = int(os.getenv("API_MAX_RETRIES", "3"))

    # Port for this agent API (8082 so 8080/8081 can stay for Weaviate)
    AGENT_PORT: int = int(os.getenv("AGENT_PORT", "8082"))

    def validate(self) -> list[str]:
        """Return a list of missing-but-required configuration keys."""
        missing: list[str] = []
        if not self.OPENAI_API_KEY:
            missing.append("OPENAI_API_KEY")
        if not self.CLOUDFUZE_TOKEN:
            missing.append("CLOUDFUZE_TOKEN")
        return missing


settings = Settings()
