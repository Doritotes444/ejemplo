"""tiendapp_full_saas_platform

Revision ID: 013
Revises: 012
Create Date: 2026-10-19

Expande el esquema de Tiendapp para cubrir todos los módulos comerciales y operativos:
- Nuevos valores en enums (planempresa: standard; categoriaproducto: Abarrotes, Granos, Carnes Frias, Frutas y Verduras, Licores, Otros).
- Columnas adicionales en productos (stock_minimo, proveedor, tiempo_reposicion_dias, es_provisional, es_frecuente, foto_url tipo Text).
- Tabla sesiones_caja y movimientos_caja (apertura, cierre, ingresos, egresos, cuadre y diferencias).
- Tabla movimientos_inventario (entradas, salidas, ajustes, ventas, anulaciones con motivo y auditoría).
- Columnas adicionales en ventas y detalles_venta (metodo_pago, monto_recibido, cambio_entregado, estado, motivo_anulacion, anulada_por_id, anulada_en, sesion_caja_id, client_operation_id, costo_unitario_snapshot).
- Tabla comprobantes_pago (escáner de comprobantes QR con foto local/privada y estado explícito CAPTURADO_NO_VERIFICADO vs VERIFICADO_MANUALMENTE).
- Tabla planes_config (3 planes configurables: Gratis/basic, Standard, Pro).
- Tabla password_reset_tokens y audit_logs.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE planempresa ADD VALUE IF NOT EXISTS 'standard'")
        for val in ("Abarrotes", "Granos", "Carnes Frias", "Frutas y Verduras", "Licores", "Otros"):
            op.execute(f"ALTER TYPE categoriaproducto ADD VALUE IF NOT EXISTS '{val}'")

    # 1. Columnas adicionales en productos
    op.add_column("productos", sa.Column("stock_minimo", sa.Numeric(10, 3), nullable=False, server_default="5.000"))
    op.add_column("productos", sa.Column("proveedor", sa.String(length=150), nullable=True))
    op.add_column("productos", sa.Column("tiempo_reposicion_dias", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("productos", sa.Column("es_provisional", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("productos", sa.Column("es_frecuente", sa.Boolean(), nullable=False, server_default="false"))
    if bind.dialect.name == "postgresql":
        op.alter_column("productos", "foto_url", type_=sa.Text(), existing_nullable=True)

    # 2. Tabla sesiones_caja
    op.create_table(
        "sesiones_caja",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("empresa_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("usuario_apertura_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True),
        sa.Column("usuario_apertura_nombre", sa.String(length=100), nullable=True),
        sa.Column("usuario_cierre_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True),
        sa.Column("usuario_cierre_nombre", sa.String(length=100), nullable=True),
        sa.Column("estado", sa.String(length=20), nullable=False, server_default="abierta"),
        sa.Column("fecha_apertura", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("fecha_cierre", sa.DateTime(timezone=True), nullable=True),
        sa.Column("monto_inicial", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("total_ventas_efectivo", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("total_ventas_digital", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("total_ingresos_extra", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("total_egresos", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("saldo_esperado_efectivo", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("monto_contado_fisico", sa.Numeric(12, 2), nullable=True),
        sa.Column("diferencia", sa.Numeric(12, 2), nullable=True),
        sa.Column("observaciones", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.create_index("idx_sesiones_caja_empresa_estado", "sesiones_caja", ["empresa_id", "estado"])

    # 3. Columnas adicionales en ventas y detalles_venta
    op.add_column("ventas", sa.Column("metodo_pago", sa.String(length=30), nullable=False, server_default="efectivo"))
    op.add_column("ventas", sa.Column("monto_recibido", sa.Numeric(12, 2), nullable=True))
    op.add_column("ventas", sa.Column("cambio_entregado", sa.Numeric(12, 2), nullable=True, server_default="0.00"))
    op.add_column("ventas", sa.Column("estado", sa.String(length=20), nullable=False, server_default="completada"))
    op.add_column("ventas", sa.Column("motivo_anulacion", sa.String(length=255), nullable=True))
    op.add_column("ventas", sa.Column("anulada_por_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("ventas", sa.Column("anulada_en", sa.DateTime(timezone=True), nullable=True))
    op.add_column("ventas", sa.Column("sesion_caja_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("ventas", sa.Column("client_operation_id", sa.String(length=100), nullable=True))
    op.add_column("ventas", sa.Column("cliente_nombre", sa.String(length=120), nullable=True))
    op.add_column("ventas", sa.Column("notas", sa.String(length=255), nullable=True))
    op.create_unique_constraint("uq_venta_empresa_client_op", "ventas", ["empresa_id", "client_operation_id"])
    op.create_foreign_key("fk_ventas_anulada_por", "ventas", "usuarios", ["anulada_por_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_ventas_sesion_caja", "ventas", "sesiones_caja", ["sesion_caja_id"], ["id"], ondelete="SET NULL")

    op.add_column("detalles_venta", sa.Column("costo_unitario_snapshot", sa.Numeric(12, 2), nullable=True, server_default="0.00"))

    # 4. Tabla movimientos_inventario
    op.create_table(
        "movimientos_inventario",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("empresa_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("producto_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("productos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("usuario_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True),
        sa.Column("usuario_nombre_snapshot", sa.String(length=100), nullable=True),
        sa.Column("tipo", sa.String(length=30), nullable=False),
        sa.Column("cantidad", sa.Numeric(10, 3), nullable=False),
        sa.Column("stock_anterior", sa.Numeric(10, 3), nullable=False),
        sa.Column("stock_nuevo", sa.Numeric(10, 3), nullable=False),
        sa.Column("costo_unitario", sa.Numeric(12, 2), nullable=True),
        sa.Column("motivo", sa.String(length=255), nullable=True),
        sa.Column("referencia_id", sa.String(length=100), nullable=True),
        sa.Column("client_operation_id", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.UniqueConstraint("empresa_id", "client_operation_id", name="uq_mov_inv_empresa_client_op"),
    )
    op.create_index("idx_mov_inv_empresa_fecha", "movimientos_inventario", ["empresa_id", "created_at"])
    op.create_index("idx_mov_inv_producto", "movimientos_inventario", ["producto_id"])

    # 5. Tabla movimientos_caja
    op.create_table(
        "movimientos_caja",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("empresa_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sesion_caja_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sesiones_caja.id", ondelete="CASCADE"), nullable=True),
        sa.Column("usuario_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True),
        sa.Column("usuario_nombre_snapshot", sa.String(length=100), nullable=True),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("categoria", sa.String(length=60), nullable=False, server_default="general"),
        sa.Column("metodo_pago", sa.String(length=30), nullable=False, server_default="efectivo"),
        sa.Column("monto", sa.Numeric(12, 2), nullable=False),
        sa.Column("concepto", sa.String(length=255), nullable=False),
        sa.Column("referencia_venta_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ventas.id", ondelete="SET NULL"), nullable=True),
        sa.Column("fecha", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("client_operation_id", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.UniqueConstraint("empresa_id", "client_operation_id", name="uq_mov_caja_empresa_client_op"),
    )
    op.create_index("idx_mov_caja_empresa_fecha", "movimientos_caja", ["empresa_id", "fecha"])
    op.create_index("idx_mov_caja_sesion", "movimientos_caja", ["sesion_caja_id"])

    # 6. Tabla comprobantes_pago
    op.create_table(
        "comprobantes_pago",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("empresa_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("empresas.id", ondelete="CASCADE"), nullable=False),
        sa.Column("venta_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ventas.id", ondelete="SET NULL"), nullable=True),
        sa.Column("usuario_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True),
        sa.Column("usuario_nombre_snapshot", sa.String(length=100), nullable=True),
        sa.Column("billetera", sa.String(length=40), nullable=False, server_default="nequi"),
        sa.Column("referencia_pago", sa.String(length=120), nullable=True),
        sa.Column("monto", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("qr_raw_data", sa.Text(), nullable=True),
        sa.Column("imagen_data", sa.Text(), nullable=True),
        sa.Column("imagen_mime", sa.String(length=50), nullable=True),
        sa.Column("estado_verificacion", sa.String(length=40), nullable=False, server_default="CAPTURADO_NO_VERIFICADO"),
        sa.Column("verificado_por_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True),
        sa.Column("verificado_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notas", sa.String(length=255), nullable=True),
        sa.Column("client_operation_id", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.UniqueConstraint("empresa_id", "client_operation_id", name="uq_comprobante_empresa_client_op"),
    )
    op.create_index("idx_comprobantes_empresa_fecha", "comprobantes_pago", ["empresa_id", "created_at"])

    # 7. Tabla planes_config
    op.create_table(
        "planes_config",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("codigo", sa.String(length=30), unique=True, nullable=False),
        sa.Column("nombre", sa.String(length=80), nullable=False),
        sa.Column("descripcion", sa.String(length=255), nullable=True),
        sa.Column("precio_mensual_cop", sa.Numeric(12, 2), nullable=False, server_default="0.00"),
        sa.Column("max_usuarios", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("max_cajeros", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("max_productos", sa.Integer(), nullable=False, server_default="200"),
        sa.Column("max_ventas_mensuales", sa.Integer(), nullable=False, server_default="500"),
        sa.Column("max_comprobantes_qr", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("acceso_simulador", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("acceso_reportes_avanzados", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("acceso_alertas_inteligentes", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("acceso_exportacion_excel", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("soporte_prioritario", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
    )

    # 8. Tabla password_reset_tokens
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("usuario_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(length=128), unique=True, nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_pwd_reset_usuario", "password_reset_tokens", ["usuario_id"])

    # 9. Tabla audit_logs
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("empresa_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("empresas.id", ondelete="SET NULL"), nullable=True),
        sa.Column("usuario_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True),
        sa.Column("actor_email", sa.String(length=255), nullable=True),
        sa.Column("accion", sa.String(length=80), nullable=False),
        sa.Column("entidad", sa.String(length=60), nullable=True),
        sa.Column("entidad_id", sa.String(length=100), nullable=True),
        sa.Column("detalle", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=60), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_audit_logs_empresa_fecha", "audit_logs", ["empresa_id", "created_at"])
    op.create_index("idx_audit_logs_accion", "audit_logs", ["accion"])


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("password_reset_tokens")
    op.drop_table("planes_config")
    op.drop_table("comprobantes_pago")
    op.drop_table("movimientos_caja")
    op.drop_table("movimientos_inventario")
    op.drop_column("detalles_venta", "costo_unitario_snapshot")
    op.drop_constraint("fk_ventas_sesion_caja", "ventas", type_="foreignkey")
    op.drop_constraint("fk_ventas_anulada_por", "ventas", type_="foreignkey")
    op.drop_constraint("uq_venta_empresa_client_op", "ventas", type_="unique")
    for col in ("notas", "cliente_nombre", "client_operation_id", "sesion_caja_id", "anulada_en", "anulada_por_id", "motivo_anulacion", "estado", "cambio_entregado", "monto_recibido", "metodo_pago"):
        op.drop_column("ventas", col)
    op.drop_table("sesiones_caja")
    for col in ("es_frecuente", "es_provisional", "tiempo_reposicion_dias", "proveedor", "stock_minimo"):
        op.drop_column("productos", col)
