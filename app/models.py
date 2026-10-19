import uuid
import enum
from sqlalchemy import (
    Column, String, Numeric, Boolean, Date, Text, Integer, LargeBinary,
    DateTime, ForeignKey, Enum as SAEnum, Index, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class RolUsuario(str, enum.Enum):
    ADMIN   = "admin"
    TENDERO = "tendero"


class PlanEmpresa(str, enum.Enum):
    BASIC    = "basic"
    STANDARD = "standard"
    PRO      = "pro"
    MEDIUM   = "medium"
    PREMIUM  = "premium"


class UnidadMedida(str, enum.Enum):
    UNIDAD = "unidad"
    GRAMO  = "gramo"
    LIBRA  = "libra"
    KILO   = "kilo"
    CAJA   = "caja"
    BULTO  = "bulto"
    KG     = "kg"
    LITRO  = "litro"
    METRO  = "metro"


class CategoriaProducto(str, enum.Enum):
    BEBIDAS         = "Bebidas"
    SNACKS          = "Snacks"
    ASEO            = "Aseo"
    LACTEOS         = "Lacteos"
    LIMPIEZA        = "Limpieza"
    PANADERIA       = "Panaderia"
    ABARROTES       = "Abarrotes"
    GRANOS          = "Granos"
    CARNES_FRIAS    = "Carnes Frias"
    FRUTAS_VERDURAS = "Frutas y Verduras"
    LICORES         = "Licores"
    OTROS           = "Otros"


class EstadoTicket(str, enum.Enum):
    ABIERTO    = "abierto"
    RESPONDIDO = "respondido"
    CERRADO    = "cerrado"


class RemitenteRol(str, enum.Enum):
    SUPERADMIN = "superadmin"
    USUARIO    = "usuario"


# ---------------------------------------------------------------------------
# AuditMixin
# ---------------------------------------------------------------------------

class AuditMixin:
    """created_at/updated_at/is_active inherited by all main tables."""
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    is_active = Column(Boolean, default=True, server_default="true", nullable=False)


# ---------------------------------------------------------------------------
# Empresa (raíz del árbol multi-tenant)
# ---------------------------------------------------------------------------

class Empresa(AuditMixin, Base):
    __tablename__ = "empresas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre_comercial = Column(String(150), nullable=False)
    nit_o_cedula = Column(String(50), unique=True, nullable=False)
    plan = Column(
        SAEnum(PlanEmpresa, name="planempresa", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        server_default="basic",
    )
    trial_expires_at = Column(DateTime(timezone=True), nullable=True)

    usuarios          = relationship("Usuario",        back_populates="empresa", cascade="all, delete-orphan")
    productos         = relationship("Producto",       back_populates="empresa", cascade="all, delete-orphan")
    ventas            = relationship("Venta",          back_populates="empresa", cascade="all, delete-orphan")
    soporte_tickets   = relationship("SoporteTicket",  back_populates="empresa", cascade="all, delete-orphan")
    agent_commands    = relationship("AgentCommand",   back_populates="empresa", cascade="all, delete-orphan")
    sesiones_caja     = relationship("SesionCaja",     back_populates="empresa", cascade="all, delete-orphan")
    movimientos_caja  = relationship("MovimientoCaja", back_populates="empresa", cascade="all, delete-orphan")
    comprobantes_pago = relationship("ComprobantePago", back_populates="empresa", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Empresa {self.nombre_comercial!r}>"


# ---------------------------------------------------------------------------
# Usuario
# ---------------------------------------------------------------------------

class Usuario(AuditMixin, Base):
    __tablename__ = "usuarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    empresa_id = Column(
        UUID(as_uuid=True),
        ForeignKey("empresas.id", ondelete="CASCADE"),
        nullable=False,
    )
    rol = Column(
        SAEnum(RolUsuario, name="rolusuario", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=RolUsuario.TENDERO,
    )
    nombre = Column(String(100), nullable=True)
    telefono_whatsapp = Column(String(20), nullable=True, unique=True)
    # Operador de la plataforma Tiendapp. Solo se asigna desde servidor (script/BD),
    # nunca desde un formulario público. Usa el mismo login que el resto de usuarios.
    es_superadmin = Column(Boolean, nullable=False, default=False, server_default="0")

    empresa = relationship("Empresa", back_populates="usuarios")
    ventas  = relationship("Venta", back_populates="usuario", foreign_keys="Venta.usuario_id")

    __table_args__ = (
        Index("idx_usuarios_email", "email"),
    )

    def __repr__(self) -> str:
        return f"<Usuario {self.email!r} nombre={self.nombre!r} rol={self.rol}>"


# ---------------------------------------------------------------------------
# Producto
# ---------------------------------------------------------------------------

class Producto(AuditMixin, Base):
    __tablename__ = "productos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    empresa_id = Column(
        UUID(as_uuid=True),
        ForeignKey("empresas.id", ondelete="CASCADE"),
        nullable=False,
    )
    codigo_barras = Column(String(100), nullable=False)
    nombre = Column(String(150), nullable=False)
    precio_costo = Column(Numeric(12, 2), nullable=False)
    precio_venta = Column(Numeric(12, 2), nullable=False)
    cantidad_actual = Column(Numeric(10, 3), nullable=False, default=0.0)
    stock_minimo = Column(Numeric(10, 3), nullable=False, default=5.0, server_default="5.000")
    unidad_medida = Column(
        SAEnum(UnidadMedida, name="unidadmedida", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        server_default="unidad",
    )
    fecha_vencimiento = Column(Date, nullable=True)
    categoria = Column(
        SAEnum(CategoriaProducto, name="categoriaproducto", values_callable=lambda x: [e.value for e in x]),
        nullable=True,
    )
    foto_url = Column(Text, nullable=True)
    proveedor = Column(String(150), nullable=True)
    tiempo_reposicion_dias = Column(Integer, nullable=False, default=1, server_default="1")
    es_provisional = Column(Boolean, default=False, server_default="false", nullable=False)
    es_frecuente = Column(Boolean, default=False, server_default="false", nullable=False)

    empresa = relationship("Empresa", back_populates="productos")
    detalles_venta = relationship("DetalleVenta", back_populates="producto", passive_deletes=True)
    movimientos = relationship("MovimientoInventario", back_populates="producto", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("empresa_id", "codigo_barras", name="uq_producto_empresa_barras"),
        Index("idx_productos_empresa", "empresa_id"),
    )

    def __repr__(self) -> str:
        return f"<Producto {self.nombre!r} stock={self.cantidad_actual}>"


# ---------------------------------------------------------------------------
# MovimientoInventario (Entradas, Salidas, Ajustes, Ventas, Anulaciones)
# ---------------------------------------------------------------------------

class MovimientoInventario(AuditMixin, Base):
    __tablename__ = "movimientos_inventario"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    empresa_id = Column(
        UUID(as_uuid=True),
        ForeignKey("empresas.id", ondelete="CASCADE"),
        nullable=False,
    )
    producto_id = Column(
        UUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="CASCADE"),
        nullable=False,
    )
    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    )
    usuario_nombre_snapshot = Column(String(100), nullable=True)
    tipo = Column(String(30), nullable=False)  # entrada, salida, ajuste, venta, anulacion_venta, inicial
    cantidad = Column(Numeric(10, 3), nullable=False)
    stock_anterior = Column(Numeric(10, 3), nullable=False)
    stock_nuevo = Column(Numeric(10, 3), nullable=False)
    costo_unitario = Column(Numeric(12, 2), nullable=True)
    motivo = Column(String(255), nullable=True)
    referencia_id = Column(String(100), nullable=True)
    client_operation_id = Column(String(100), nullable=True)

    producto = relationship("Producto", back_populates="movimientos")

    __table_args__ = (
        UniqueConstraint("empresa_id", "client_operation_id", name="uq_mov_inv_empresa_client_op"),
        Index("idx_mov_inv_empresa_fecha", "empresa_id", "created_at"),
        Index("idx_mov_inv_producto", "producto_id"),
    )


# ---------------------------------------------------------------------------
# SesionCaja (Apertura, Cierre, Arqueo y Diferencias)
# ---------------------------------------------------------------------------

class SesionCaja(AuditMixin, Base):
    __tablename__ = "sesiones_caja"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    empresa_id = Column(
        UUID(as_uuid=True),
        ForeignKey("empresas.id", ondelete="CASCADE"),
        nullable=False,
    )
    usuario_apertura_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    )
    usuario_apertura_nombre = Column(String(100), nullable=True)
    usuario_cierre_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    )
    usuario_cierre_nombre = Column(String(100), nullable=True)
    estado = Column(String(20), nullable=False, default="abierta", server_default="abierta")  # abierta, cerrada
    fecha_apertura = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    fecha_cierre = Column(DateTime(timezone=True), nullable=True)
    monto_inicial = Column(Numeric(12, 2), nullable=False, default=0.0, server_default="0.00")
    total_ventas_efectivo = Column(Numeric(12, 2), nullable=False, default=0.0, server_default="0.00")
    total_ventas_digital = Column(Numeric(12, 2), nullable=False, default=0.0, server_default="0.00")
    total_ingresos_extra = Column(Numeric(12, 2), nullable=False, default=0.0, server_default="0.00")
    total_egresos = Column(Numeric(12, 2), nullable=False, default=0.0, server_default="0.00")
    saldo_esperado_efectivo = Column(Numeric(12, 2), nullable=False, default=0.0, server_default="0.00")
    monto_contado_fisico = Column(Numeric(12, 2), nullable=True)
    diferencia = Column(Numeric(12, 2), nullable=True)
    observaciones = Column(Text, nullable=True)

    empresa = relationship("Empresa", back_populates="sesiones_caja")
    movimientos = relationship("MovimientoCaja", back_populates="sesion_caja", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_sesiones_caja_empresa_estado", "empresa_id", "estado"),
    )


# ---------------------------------------------------------------------------
# Venta
# ---------------------------------------------------------------------------

class Venta(AuditMixin, Base):
    __tablename__ = "ventas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    empresa_id = Column(
        UUID(as_uuid=True),
        ForeignKey("empresas.id", ondelete="CASCADE"),
        nullable=False,
    )
    fecha_venta = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    total = Column(Numeric(12, 2), nullable=False, server_default="0.00")
    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    )
    vendedor_nombre_snapshot = Column(String(100), nullable=True)
    metodo_pago = Column(String(30), nullable=False, default="efectivo", server_default="efectivo")
    monto_recibido = Column(Numeric(12, 2), nullable=True)
    cambio_entregado = Column(Numeric(12, 2), nullable=True, default=0.0, server_default="0.00")
    estado = Column(String(20), nullable=False, default="completada", server_default="completada")  # completada, anulada
    motivo_anulacion = Column(String(255), nullable=True)
    anulada_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    )
    anulada_en = Column(DateTime(timezone=True), nullable=True)
    sesion_caja_id = Column(
        UUID(as_uuid=True),
        ForeignKey("sesiones_caja.id", ondelete="SET NULL"),
        nullable=True,
    )
    client_operation_id = Column(String(100), nullable=True)
    cliente_nombre = Column(String(120), nullable=True)
    notas = Column(String(255), nullable=True)

    empresa  = relationship("Empresa", back_populates="ventas")
    usuario  = relationship("Usuario", back_populates="ventas", foreign_keys=[usuario_id])
    detalles = relationship("DetalleVenta", back_populates="venta", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("empresa_id", "client_operation_id", name="uq_venta_empresa_client_op"),
        Index("idx_ventas_empresa_fecha", "empresa_id", "fecha_venta"),
        Index("idx_ventas_usuario_id", "usuario_id"),
    )

    def __repr__(self) -> str:
        return f"<Venta id={self.id} total={self.total} estado={self.estado}>"


# ---------------------------------------------------------------------------
# DetalleVenta
# ---------------------------------------------------------------------------

class DetalleVenta(AuditMixin, Base):
    __tablename__ = "detalles_venta"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    venta_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ventas.id", ondelete="CASCADE"),
        nullable=False,
    )
    producto_id = Column(
        UUID(as_uuid=True),
        ForeignKey("productos.id", ondelete="RESTRICT"),
        nullable=False,
    )
    cantidad = Column(Numeric(10, 3), nullable=False)
    precio_unitario = Column(Numeric(12, 2), nullable=False)
    costo_unitario_snapshot = Column(Numeric(12, 2), nullable=True, default=0.0, server_default="0.00")
    subtotal = Column(Numeric(12, 2), nullable=False)

    venta    = relationship("Venta", back_populates="detalles")
    producto = relationship("Producto", back_populates="detalles_venta")

    __table_args__ = (
        Index("idx_detalles_venta_venta_id", "venta_id"),
    )

    def __repr__(self) -> str:
        return f"<DetalleVenta venta={self.venta_id} producto={self.producto_id} qty={self.cantidad}>"


# ---------------------------------------------------------------------------
# MovimientoCaja (Ingresos, Egresos, Ventas y Anulaciones en Caja)
# ---------------------------------------------------------------------------

class MovimientoCaja(AuditMixin, Base):
    __tablename__ = "movimientos_caja"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    empresa_id = Column(
        UUID(as_uuid=True),
        ForeignKey("empresas.id", ondelete="CASCADE"),
        nullable=False,
    )
    sesion_caja_id = Column(
        UUID(as_uuid=True),
        ForeignKey("sesiones_caja.id", ondelete="CASCADE"),
        nullable=True,
    )
    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    )
    usuario_nombre_snapshot = Column(String(100), nullable=True)
    tipo = Column(String(20), nullable=False)  # ingreso, egreso, venta, anulacion_venta
    categoria = Column(String(60), nullable=False, default="general", server_default="general")
    metodo_pago = Column(String(30), nullable=False, default="efectivo", server_default="efectivo")
    monto = Column(Numeric(12, 2), nullable=False)
    concepto = Column(String(255), nullable=False)
    referencia_venta_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ventas.id", ondelete="SET NULL"),
        nullable=True,
    )
    fecha = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    client_operation_id = Column(String(100), nullable=True)

    empresa = relationship("Empresa", back_populates="movimientos_caja")
    sesion_caja = relationship("SesionCaja", back_populates="movimientos")

    __table_args__ = (
        UniqueConstraint("empresa_id", "client_operation_id", name="uq_mov_caja_empresa_client_op"),
        Index("idx_mov_caja_empresa_fecha", "empresa_id", "fecha"),
        Index("idx_mov_caja_sesion", "sesion_caja_id"),
    )


# ---------------------------------------------------------------------------
# ComprobantePago (Escáner y Bóveda de Comprobantes QR)
# ---------------------------------------------------------------------------

class ComprobantePago(AuditMixin, Base):
    __tablename__ = "comprobantes_pago"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    empresa_id = Column(
        UUID(as_uuid=True),
        ForeignKey("empresas.id", ondelete="CASCADE"),
        nullable=False,
    )
    venta_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ventas.id", ondelete="SET NULL"),
        nullable=True,
    )
    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    )
    usuario_nombre_snapshot = Column(String(100), nullable=True)
    billetera = Column(String(40), nullable=False, default="nequi", server_default="nequi")  # nequi, daviplata, bancolombia, bre_b, otro
    referencia_pago = Column(String(120), nullable=True)
    monto = Column(Numeric(12, 2), nullable=False, default=0.0, server_default="0.00")
    qr_raw_data = Column(Text, nullable=True)
    imagen_data = Column(Text, nullable=True)
    imagen_mime = Column(String(50), nullable=True, default="image/jpeg")
    estado_verificacion = Column(
        String(40),
        nullable=False,
        default="CAPTURADO_NO_VERIFICADO",
        server_default="CAPTURADO_NO_VERIFICADO",
    )  # CAPTURADO_NO_VERIFICADO, VERIFICADO_MANUALMENTE, RECHAZADO
    verificado_por_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    )
    verificado_en = Column(DateTime(timezone=True), nullable=True)
    notas = Column(String(255), nullable=True)
    client_operation_id = Column(String(100), nullable=True)

    empresa = relationship("Empresa", back_populates="comprobantes_pago")

    __table_args__ = (
        UniqueConstraint("empresa_id", "client_operation_id", name="uq_comprobante_empresa_client_op"),
        Index("idx_comprobantes_empresa_fecha", "empresa_id", "created_at"),
    )


# ---------------------------------------------------------------------------
# PlanConfig (3 Planes Comerciales Configurables: Gratis/basic, Standard, Pro)
# ---------------------------------------------------------------------------

class PlanConfig(AuditMixin, Base):
    __tablename__ = "planes_config"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo = Column(String(30), unique=True, nullable=False)  # basic, standard, pro
    nombre = Column(String(80), nullable=False)               # Gratis, Standard, Pro
    descripcion = Column(String(255), nullable=True)
    precio_mensual_cop = Column(Numeric(12, 2), nullable=False, default=0.0, server_default="0.00")
    max_usuarios = Column(Integer, nullable=False, default=4, server_default="4")
    max_cajeros = Column(Integer, nullable=False, default=3, server_default="3")
    max_productos = Column(Integer, nullable=False, default=200, server_default="200")
    max_ventas_mensuales = Column(Integer, nullable=False, default=500, server_default="500")
    max_comprobantes_qr = Column(Integer, nullable=False, default=50, server_default="50")
    acceso_simulador = Column(Boolean, nullable=False, default=False, server_default="false")
    acceso_reportes_avanzados = Column(Boolean, nullable=False, default=False, server_default="false")
    acceso_alertas_inteligentes = Column(Boolean, nullable=False, default=True, server_default="true")
    acceso_exportacion_excel = Column(Boolean, nullable=False, default=False, server_default="false")
    soporte_prioritario = Column(Boolean, nullable=False, default=False, server_default="false")


# ---------------------------------------------------------------------------
# PasswordResetToken (Recuperación segura de contraseña)
# ---------------------------------------------------------------------------

class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash = Column(String(128), unique=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_pwd_reset_usuario", "usuario_id"),
    )


# ---------------------------------------------------------------------------
# AuditLog (Registro persistente de auditoría y eventos sensibles)
# ---------------------------------------------------------------------------

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    empresa_id = Column(
        UUID(as_uuid=True),
        ForeignKey("empresas.id", ondelete="SET NULL"),
        nullable=True,
    )
    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_email = Column(String(255), nullable=True)
    accion = Column(String(80), nullable=False)
    entidad = Column(String(60), nullable=True)
    entidad_id = Column(String(100), nullable=True)
    detalle = Column(Text, nullable=True)
    ip_address = Column(String(60), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_audit_logs_empresa_fecha", "empresa_id", "created_at"),
        Index("idx_audit_logs_accion", "accion"),
    )


# ---------------------------------------------------------------------------
# SoporteTicket
# ---------------------------------------------------------------------------

class SoporteTicket(AuditMixin, Base):
    __tablename__ = "soporte_tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    empresa_id = Column(
        UUID(as_uuid=True),
        ForeignKey("empresas.id", ondelete="CASCADE"),
        nullable=False,
    )
    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="RESTRICT"),
        nullable=False,
    )
    asunto = Column(String(150), nullable=False)
    estado = Column(
        SAEnum(EstadoTicket, name="estadoticket", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        server_default="abierto",
    )

    empresa  = relationship("Empresa", back_populates="soporte_tickets")
    usuario  = relationship("Usuario", foreign_keys=[usuario_id], viewonly=True)
    mensajes = relationship(
        "SoporteMensaje",
        back_populates="ticket",
        cascade="all, delete-orphan",
        order_by="SoporteMensaje.created_at",
    )

    __table_args__ = (
        Index("idx_soporte_tickets_empresa", "empresa_id"),
    )

    def __repr__(self) -> str:
        return f"<SoporteTicket {self.asunto!r} estado={self.estado}>"


# ---------------------------------------------------------------------------
# SoporteMensaje
# ---------------------------------------------------------------------------

class SoporteMensaje(Base):
    __tablename__ = "soporte_mensajes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ticket_id = Column(
        UUID(as_uuid=True),
        ForeignKey("soporte_tickets.id", ondelete="CASCADE"),
        nullable=False,
    )
    remitente_rol = Column(
        SAEnum(RemitenteRol, name="remitenterol", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    remitente_email = Column(String(255), nullable=False)
    mensaje = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    ticket = relationship("SoporteTicket", back_populates="mensajes")

    __table_args__ = (
        Index("idx_soporte_mensajes_ticket", "ticket_id"),
    )

    def __repr__(self) -> str:
        return f"<SoporteMensaje rol={self.remitente_rol!r}>"


# ---------------------------------------------------------------------------
# Agente IA — Transacciones e Idempotencia
# ---------------------------------------------------------------------------

class AgentCommand(AuditMixin, Base):
    __tablename__ = "agent_commands"

    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    empresa_id      = Column(UUID(as_uuid=True), ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False)
    conversation_id = Column(String(100), nullable=False)
    command_id      = Column(String(100), nullable=False)
    action          = Column(String(50), nullable=False)
    payload         = Column(Text, nullable=True)  # JSON string
    status          = Column(String(30), nullable=False, default="PENDIENTE")  # PENDIENTE, EJECUTADO, RECHAZADO, INVALIDADO
    result          = Column(Text, nullable=True)   # JSON string
    executed_at     = Column(DateTime(timezone=True), nullable=True)

    empresa = relationship("Empresa", back_populates="agent_commands")

    __table_args__ = (
        UniqueConstraint("empresa_id", "command_id", name="uq_empresa_command_id"),
        Index("idx_agent_commands_empresa", "empresa_id"),
        Index("idx_agent_commands_command", "command_id"),
        Index("idx_agent_commands_conversation", "conversation_id"),
    )

    def __repr__(self) -> str:
        return f"<AgentCommand {self.command_id} [{self.status}]>"


# ---------------------------------------------------------------------------
# Biblioteca de imágenes de productos (deduplicada por hash y aislada por negocio)
# ---------------------------------------------------------------------------

class ImagenProducto(AuditMixin, Base):
    """
    Imagen reutilizable del catálogo de un negocio.

    - `sha256` se calcula sobre la versión optimizada: si el mismo archivo se sube
      dos veces dentro del mismo negocio, se reutiliza el registro existente.
    - Se guarda la versión optimizada (≈640 px) y una miniatura (≈160 px). El original
      del dispositivo nunca se sube: se comprime en el cliente antes de enviarse.
    - Los productos la referencian por `Producto.foto_url = /api/imagenes/{id}/archivo`.
      El conteo de referencias se calcula sobre esa columna, de modo que no se puede
      borrar una imagen mientras algún producto la use.
    - El acceso exige autenticación del mismo negocio (no hay URLs públicas).
    """
    __tablename__ = "imagenes_producto"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    empresa_id = Column(
        UUID(as_uuid=True),
        ForeignKey("empresas.id", ondelete="CASCADE"),
        nullable=False,
    )
    sha256 = Column(String(64), nullable=False)
    mime = Column(String(40), nullable=False, default="image/webp")
    ancho = Column(Integer, nullable=True)
    alto = Column(Integer, nullable=True)
    bytes_optimizada = Column(Integer, nullable=False, default=0)
    data_optimizada = Column(LargeBinary, nullable=False)
    data_miniatura = Column(LargeBinary, nullable=False)
    nombre = Column(String(120), nullable=True)

    __table_args__ = (
        UniqueConstraint("empresa_id", "sha256", name="uq_imagen_empresa_sha256"),
        Index("idx_imagenes_empresa", "empresa_id"),
    )
