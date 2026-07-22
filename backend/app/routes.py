from fastapi import APIRouter, Request, Response
import httpx
from .config import API_BASE, JWT_TOKEN, PROJECT_ID

router = APIRouter()

@router.api_route("/{full_path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy(full_path: str, request: Request):
    # Build target URL
    target_url = f"{API_BASE}/{full_path}"
    # Prepare headers – keep content-type from client if present
    client_headers = {
        "Authorization": f"Bearer {JWT_TOKEN}",
        "x-application-tenant": PROJECT_ID,
    }
    # Preserve original content-type if provided
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
