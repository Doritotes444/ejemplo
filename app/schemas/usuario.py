from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator

from app.models import RolUsuario


class UsuarioCrear(BaseModel):
    nombre: Optional[str] = None
    email: EmailStr
    password: str
    empresa_id: UUID
    rol: RolUsuario = RolUsuario.TENDERO

    @field_validator("password")
    @classmethod
    def password_minimo(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        import re
        if (
            not re.search(r"[A-Z]", v)
            or not re.search(r"[a-z]", v)
            or not re.search(r"[0-9]", v)
            or not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v)
        ):
            raise ValueError(
                "La contraseña debe incluir al menos una letra mayúscula, "
                "una letra minúscula, un número y un carácter especial"
            )
        return v


class UsuarioRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: Optional[str] = None
    email: str
    empresa_id: UUID
    rol: RolUsuario
    created_at: datetime
    is_active: bool
    es_superadmin: bool = False


class UsuarioCrearConEmpresa(BaseModel):
    """Schema para registro atómico de empresa + usuario en un solo endpoint."""
    nombre_comercial: str
    nit_o_cedula: str
    nombre: Optional[str] = None
    email: EmailStr
    password: str
    rol: RolUsuario = RolUsuario.ADMIN

    @field_validator("nombre_comercial")
    @classmethod
    def nombre_empresa_valido(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El nombre comercial no puede estar vacío")
        if len(v) > 150:
            raise ValueError("El nombre comercial no puede exceder 150 caracteres")
        return v

    @field_validator("nit_o_cedula")
    @classmethod
    def nit_valido(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El NIT/Cédula no puede estar vacío")
        if len(v) > 50:
            raise ValueError("El NIT/Cédula no puede exceder 50 caracteres")
        return v

    @field_validator("password")
    @classmethod
    def password_minimo(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        import re
        if (
            not re.search(r"[A-Z]", v)
            or not re.search(r"[a-z]", v)
            or not re.search(r"[0-9]", v)
            or not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v)
        ):
            raise ValueError(
                "La contraseña debe incluir al menos una letra mayúscula, "
                "una letra minúscula, un número y un carácter especial"
            )
        return v


class LoginForm(BaseModel):
    email: EmailStr
    password: str


class TokenRespuesta(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioRespuesta


class EmpleadoCrear(BaseModel):
    nombre: str
    email: EmailStr
    password: str

    @field_validator("nombre")
    @classmethod
    def nombre_no_vacio(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("El nombre no puede estar vacío")
        if len(v) > 100:
            raise ValueError("El nombre no puede exceder 100 caracteres")
        return v

    @field_validator("password")
    @classmethod
    def password_minimo(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        import re
        if (
            not re.search(r"[A-Z]", v)
            or not re.search(r"[a-z]", v)
            or not re.search(r"[0-9]", v)
            or not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v)
        ):
            raise ValueError(
                "La contraseña debe incluir al menos una letra mayúscula, "
                "una letra minúscula, un número y un carácter especial"
            )
        return v


class EmpleadoEstadoUpdate(BaseModel):
    is_active: bool


class EmpleadoRespuesta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: Optional[str] = None
    email: str
    empresa_id: UUID
    rol: RolUsuario
    is_active: bool
    created_at: datetime


class SolicitudRecuperacionPassword(BaseModel):
    email: EmailStr


class ConfirmacionRecuperacionPassword(BaseModel):
    token: str
    new_password: Optional[str] = None
    nueva_password: Optional[str] = None

    @field_validator("new_password", "nueva_password")
    @classmethod
    def password_minimo(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        import re
        if (
            not re.search(r"[A-Z]", v)
            or not re.search(r"[a-z]", v)
            or not re.search(r"[0-9]", v)
            or not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v)
        ):
            raise ValueError(
                "La contraseña debe incluir al menos una letra mayúscula, "
                "una letra minúscula, un número y un carácter especial"
            )
        return v

    def obtener_password(self) -> str:
        pwd = self.new_password or self.nueva_password
        if not pwd:
            raise ValueError("Debes proporcionar la nueva contraseña")
        return pwd


class CambioPasswordAutenticado(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_minimo(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("La contraseña debe tener al menos 8 caracteres")
        import re
        if (
            not re.search(r"[A-Z]", v)
            or not re.search(r"[a-z]", v)
            or not re.search(r"[0-9]", v)
            or not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v)
        ):
            raise ValueError(
                "La contraseña debe incluir al menos una letra mayúscula, "
                "una letra minúscula, un número y un carácter especial"
            )
        return v

