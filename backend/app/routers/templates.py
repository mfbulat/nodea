import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Template, User
from ..schemas import TemplateCreate, TemplateOut
from ..security import current_user

router = APIRouter(prefix="/api/templates", tags=["templates"])


@router.get("", response_model=list[TemplateOut])
def list_templates(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Template).where(Template.owner_id == user.id).order_by(Template.created_at.desc())).all()


@router.post("", response_model=TemplateOut)
def create_template(data: TemplateCreate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    t = Template(owner_id=user.id, title=data.title, document=data.document)
    db.add(t)
    db.commit()
    return t


@router.delete("/{template_id}")
def delete_template(template_id: uuid.UUID, user: User = Depends(current_user), db: Session = Depends(get_db)):
    t = db.get(Template, template_id)
    if not t or t.owner_id != user.id:
        raise HTTPException(404, "Template not found")
    db.delete(t)
    db.commit()
    return {"ok": True}
