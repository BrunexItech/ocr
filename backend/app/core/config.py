from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Universal OCR"
    max_upload_mb: int = 25
    ocr_lang: str = "en"
    use_gpu: bool = False
    database_url: str = "sqlite:///./oqtekal.db"
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 60 * 8
    review_confidence_threshold: float = 0.85
    enable_handwriting: bool = False  # opt-in: pulls in TrOCR (torch+transformers), heavy on CPU - off by default so the core scanning flow stays fast and light


settings = Settings()
