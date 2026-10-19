"""
Biblioteca de imágenes de productos.

- Las imágenes llegan ya comprimidas desde el cliente (versión optimizada + miniatura).
- Se deduplican por SHA-256 dentro de cada negocio: subir la misma imagen dos veces
  devuelve el registro existente en vez de crear otra copia.
- Se sirven solo a usuarios autenticados del mismo negocio (no hay URLs públicas).
- No se puede borrar una imagen mientras algún producto activo la referencie.
"""
import base64
import hashlib
from typing import Optional
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.dependencies import get_current_user, get_current_user_admin
from app.services.auth_service import ALGORITHM, SECRET_KEY

router = APIRouter(prefix="/imagenes", tags=["Biblioteca de imágenes"])

MAX_OPTIMIZADA = 700 * 1024
MAX_MINIATURA = 120 * 1024


class SubirImagenRequest(BaseModel):
    optimizada: str  # data URL (image/webp|jpeg|png)
    miniatura: str
    nombre: Optional[str] = None
    ancho: Optional[int] = None
    alto: Optional[int] = None


def url_archivo(imagen_id) -> str:
    return f"/api/imagenes/{imagen_id}/archivo"


def _decodificar(data_url: str, limite: int, etiqueta: str) -> tuple[bytes, str]:
    if not data_url or not data_url.startswith("data:image/") or ";base64," not in data_url:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"La {etiqueta} debe ser una imagen válida")
    cabecera, b64 = data_url.split(";base64,", 1)
    try:
        contenido = base64.b64decode(b64, validate=True)
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"La {etiqueta} está dañada")
    if len(contenido) > limite:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            f"La {etiqueta} es demasiado pesada ({len(contenido) // 1024} KB)",
        )
    if contenido.startswith(b"\xff\xd8\xff"):
        mime = "image/jpeg"
    elif contenido.startswith(b"\x89PNG\r\n\x1a\n"):
        mime = "image/png"
    elif contenido[:4] == b"RIFF" and contenido[8:12] == b"WEBP":
        mime = "image/webp"
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"La {etiqueta} no es JPEG, PNG ni WEBP")
    return contenido, mime


def _contar_usos(db: Session, empresa_id, imagen_id) -> int:
    rutas = [url_archivo(imagen_id), f"/imagenes/{imagen_id}/archivo"]
    return (
        db.query(models.Producto)
        .filter(
            models.Producto.empresa_id == empresa_id,
            models.Producto.is_active.is_(True),
            or_(*[models.Producto.foto_url == r for r in rutas]),
        )
        .count()
    )


def _serializar(img: models.ImagenProducto, usos: int) -> dict:
    return {
        "id": str(img.id),
        "url": url_archivo(img.id),
        "miniatura_url": f"{url_archivo(img.id)}?v=mini",
        "nombre": img.nombre,
        "mime": img.mime,
        "ancho": img.ancho,
        "alto": img.alto,
        "bytes": img.bytes_optimizada,
        "usos": usos,
        "created_at": img.created_at.isoformat() if img.created_at else None,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def subir_imagen(
    data: SubirImagenRequest,
    response: Response,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user_admin),
):
    optimizada, mime = _decodificar(data.optimizada, MAX_OPTIMIZADA, "imagen")
    miniatura, _ = _decodificar(data.miniatura, MAX_MINIATURA, "miniatura")
    sha = hashlib.sha256(optimizada).hexdigest()

    existente = (
        db.query(models.ImagenProducto)
        .filter(
            models.ImagenProducto.empresa_id == current_user.empresa_id,
            models.ImagenProducto.sha256 == sha,
        )
        .first()
    )
    if existente:
        if not existente.is_active:
            existente.is_active = True
            db.commit()
        response.status_code = status.HTTP_200_OK
        return {
            **_serializar(existente, _contar_usos(db, current_user.empresa_id, existente.id)),
            "reutilizada": True,
        }

    img = models.ImagenProducto(
        empresa_id=current_user.empresa_id,
        sha256=sha,
        mime=mime,
        ancho=data.ancho,
        alto=data.alto,
        bytes_optimizada=len(optimizada),
        data_optimizada=optimizada,
        data_miniatura=miniatura,
        nombre=(data.nombre or "").strip()[:120] or None,
        is_active=True,
    )
    db.add(img)
    db.commit()
    db.refresh(img)
    return {**_serializar(img, 0), "reutilizada": False}


@router.get("")
def listar_imagenes(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user_admin),
):
    imagenes = (
        db.query(models.ImagenProducto)
        .filter(
            models.ImagenProducto.empresa_id == current_user.empresa_id,
            models.ImagenProducto.is_active.is_(True),
        )
        .order_by(models.ImagenProducto.created_at.desc())
        .all()
    )
    return [_serializar(i, _contar_usos(db, current_user.empresa_id, i.id)) for i in imagenes]


def _resolver_usuario_archivo(request: Request, db: Session) -> models.Usuario:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    token = None
    if auth and auth.lower().startswith("bearer "):
        token = auth.split(" ", 1)[1].strip()
    if not token:
        token = request.query_params.get("token")
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token requerido para ver imágenes")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")
        user_uuid = UUID(str(user_id))
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")
    user = (
        db.query(models.Usuario)
        .filter(models.Usuario.id == user_uuid, models.Usuario.is_active.is_(True))
        .first()
    )
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario no encontrado")
    return user


@router.get("/{imagen_id}/archivo")
def obtener_archivo(
    imagen_id: UUID,
    request: Request,
    v: str = Query(default="full", pattern="^(full|mini)$"),
    db: Session = Depends(get_db),
):
    current_user = _resolver_usuario_archivo(request, db)
    img = (
        db.query(models.ImagenProducto)
        .filter(
            models.ImagenProducto.id == imagen_id,
            models.ImagenProducto.empresa_id == current_user.empresa_id,
        )
        .first()
    )
    if not img:
        # 404 (no 403) para no revelar si la imagen existe en otro negocio
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Imagen no encontrada")

    etag = f'"{img.sha256[:32]}-{v}"'
    headers = {
        # Contenido inmutable (direccionado por id/hash) y privado del negocio
        "Cache-Control": "private, max-age=31536000, immutable",
        "ETag": etag,
    }
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)
    contenido = img.data_miniatura if v == "mini" else img.data_optimizada
    return Response(content=contenido, media_type=img.mime, headers=headers)


@router.delete("/{imagen_id}")
def eliminar_imagen(
    imagen_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user_admin),
):
    img = (
        db.query(models.ImagenProducto)
        .filter(
            models.ImagenProducto.id == imagen_id,
            models.ImagenProducto.empresa_id == current_user.empresa_id,
        )
        .first()
    )
    if not img:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Imagen no encontrada")
    usos = _contar_usos(db, current_user.empresa_id, img.id)
    if usos > 0:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Esta foto la usan {usos} producto(s). Cámbiales la foto antes de borrarla.",
        )
    db.delete(img)
    db.commit()
    return {"eliminada": True}
