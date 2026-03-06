import argparse

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import engine
from app.services.bootstrap import create_initial_admin, seed_demo_data


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap mini-ipam admin/demo data")
    parser.add_argument("--seed-demo", action="store_true", help="Also seed demo inventory data")
    args = parser.parse_args()

    with Session(engine) as db:
        admin = create_initial_admin(
            db,
            username=settings.admin_user,
            password=settings.admin_pass,
        )
        if admin:
            print(f"Created admin user: {admin.username}")
        else:
            print("Admin already exists; skipped user bootstrap")

        if args.seed_demo:
            created = seed_demo_data(db, actor="system")
            print(f"Seeded demo data: {created}")


if __name__ == "__main__":
    main()
