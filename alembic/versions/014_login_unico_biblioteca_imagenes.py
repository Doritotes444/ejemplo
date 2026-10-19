"""Tiendapp 2.0: login único (flag es_superadmin) y biblioteca de imágenes deduplicada.

Revision ID: 014
Revises: 013
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "usuarios",
        sa.Column("es_superadmin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.create_table(
        "imagenes_producto",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "empresa_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("empresas.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("mime", sa.String(40), nullable=False, server_default="image/webp"),
        sa.Column("ancho", sa.Integer(), nullable=True),
        sa.Column("alto", sa.Integer(), nullable=True),
        sa.Column("bytes_optimizada", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("data_optimizada", sa.LargeBinary(), nullable=False),
        sa.Column("data_miniatura", sa.LargeBinary(), nullable=False),
        sa.Column("nombre", sa.String(120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("empresa_id", "sha256", name="uq_imagen_empresa_sha256"),
    )
    op.create_index("idx_imagenes_empresa", "imagenes_producto", ["empresa_id"])

    # Los comprobantes QR ahora viven solo en el dispositivo: se purgan las fotos
    # que hubieran quedado en el servidor por versiones anteriores.
    op.execute("UPDATE comprobantes_pago SET imagen_data = NULL")


def downgrade() -> None:
    op.drop_index("idx_imagenes_empresa", table_name="imagenes_producto")
    op.drop_table("imagenes_producto")
    op.drop_column("usuarios", "es_superadmin")
