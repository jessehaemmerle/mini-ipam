"""add performance indexes for reports and ipam queries

Revision ID: 0002_performance_indexes
Revises: 0001_initial
Create Date: 2026-03-06
"""

from alembic import op

revision = "0002_performance_indexes"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_prefixes_vrf_site", "prefixes", ["vrf_id", "site_id"], unique=False)
    op.create_index(
        "ix_ip_addresses_vrf_status_address",
        "ip_addresses",
        ["vrf_id", "status", "address"],
        unique=False,
    )
    op.create_index("ix_cables_endpoint_a", "cables", ["endpoint_a_type", "endpoint_a_id"], unique=False)
    op.create_index("ix_cables_endpoint_b", "cables", ["endpoint_b_type", "endpoint_b_id"], unique=False)
    op.create_index("ix_cables_status", "cables", ["status"], unique=False)
    op.create_index(
        "ix_power_connections_src",
        "power_connections",
        ["src_type", "src_id"],
        unique=False,
    )
    op.create_index("ix_power_inlets_device_id", "power_inlets", ["device_id"], unique=False)
    op.create_index("ix_interfaces_device_id", "interfaces", ["device_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_interfaces_device_id", table_name="interfaces")
    op.drop_index("ix_power_inlets_device_id", table_name="power_inlets")
    op.drop_index("ix_power_connections_src", table_name="power_connections")
    op.drop_index("ix_cables_status", table_name="cables")
    op.drop_index("ix_cables_endpoint_b", table_name="cables")
    op.drop_index("ix_cables_endpoint_a", table_name="cables")
    op.drop_index("ix_ip_addresses_vrf_status_address", table_name="ip_addresses")
    op.drop_index("ix_prefixes_vrf_site", table_name="prefixes")
