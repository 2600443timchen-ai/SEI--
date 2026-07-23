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
    
    # 自動相容舊版的路徑：將 assistant/chat/ 改寫為 chat/
    if full_path.startswith("assistant/chat/"):
        full_path = full_path.replace("assistant/chat/", "chat/", 1)
        
    target_url = f"{settings.API_BASE}/{full_path}"
    
    # Prepare headers
    client_headers = {
        "Authorization": f"Bearer {settings.JWT_TOKEN}",
        "x-application-tenant": settings.PROJECT_ID,
    }
    
    content_type = request.headers.get("content-type")
    if content_type:
        client_headers["Content-Type"] = content_type

    try:
        # 為了支援 Streaming，不能使用 async with，需要自己控制 client 和 response 的生命週期
        client = httpx.AsyncClient(timeout=300.0)
        req = client.build_request(
            request.method,
            target_url,
            params=request.query_params,
            headers=client_headers,
            content=await request.body()
        )
        resp = await client.send(req, stream=True)
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=502,
            detail=f"Proxy error: {str(e)}"
        )
        
    response_headers = dict(resp.headers)
    # 移除這些 headers 避免瀏覽器在處理串流時發生衝突
    response_headers.pop("content-encoding", None)
    response_headers.pop("content-length", None)

    async def stream_generator():
        try:
            async for chunk in resp.aiter_raw():
                yield chunk
        finally:
            await resp.aclose()
            await client.aclose()

    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        stream_generator(),
        status_code=resp.status_code,
        headers=response_headers,
    )
