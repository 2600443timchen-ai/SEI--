import os
from fastapi import FastAPI, Request, Response, Header, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
import httpx

# --- Settings & Key Management ---
class Settings(BaseSettings):
    """Application settings loaded from environment or .env file."""
    API_BASE: str = "https://cloud.geminidata.com/api/v1"
    JWT_TOKEN: str = Field(..., env="JWT_TOKEN")
    PROJECT_ID: str = Field(..., env="PROJECT_ID")

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(__file__), ".env"),
        env_file_encoding="utf-8"
    )

_settings: Settings | None = None

def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings



# --- Application Setup ---
app = FastAPI(title="GeminiData Proxy API", openapi_url="/openapi.json")

# Allow all origins for development; restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# --- Routes ---
@app.api_route("/api/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy(full_path: str, request: Request):
    settings = get_settings()
    target_url = f"{settings.API_BASE}/{full_path}"
    
    # Prepare headers
    client_headers = {
        "Authorization": f"Bearer {settings.JWT_TOKEN}",
        "x-application-tenant": settings.PROJECT_ID,
    }
    
    content_type = request.headers.get("content-type")
    if content_type:
        client_headers["Content-Type"] = content_type
    else:
        client_headers["Content-Type"] = "application/json"

    async with httpx.AsyncClient() as client:
        resp = await client.request(
            request.method,
            target_url,
            headers=client_headers,
            content=await request.body(),
            timeout=30.0,
        )
        
    return Response(
        content=resp.content,
        status_code=resp.status_code,
        media_type=resp.headers.get("content-type", "application/json"),
    )
