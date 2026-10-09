import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import StreamingResponse

from ..models import User
from ..security import current_user
from ..storage import get_object, put_object

router = APIRouter(prefix="/api/files", tags=["files"])
MAX_SIZE = 25 * 1024 * 1024


@router.post("")
async def upload(file: UploadFile, user: User = Depends(current_user)):
    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(413, "Файл больше 25 МБ")
    key = f"{user.id}/{uuid.uuid4().hex}"
    put_object(key, data, file.content_type or "application/octet-stream", file.filename)
    return {"key": key, "url": f"/api/files/{key}", "name": file.filename, "size": len(data),
            "contentType": file.content_type}


@router.get("/{owner}/{name}")
def download(owner: str, name: str):
    # Ключи неугадываемые (uuid4), поэтому отдаём по ссылке без проверки владельца —
    # это нужно для доступа по ссылке и экспорта.
    try:
        obj = get_object(f"{owner}/{name}")
    except Exception:
        raise HTTPException(404, "Файл не найден")
    headers = {"Cache-Control": "private, max-age=31536000, immutable"}
    if obj.get("ContentDisposition"):
        headers["Content-Disposition"] = obj["ContentDisposition"]
    return StreamingResponse(obj["Body"].iter_chunks(), media_type=obj.get("ContentType"), headers=headers)
