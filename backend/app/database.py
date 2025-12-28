"""Database configuration and session management."""
import os
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Get database path from environment or use default
DATABASE_PATH = os.getenv("DATABASE_PATH", "/app/data/medications.db")

# Ensure data directory exists
os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)

# Create SQLite engine
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency for getting database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database by creating all tables and running migrations."""
    Base.metadata.create_all(bind=engine)
    # Run migration for edit history if needed
    _migrate_edit_history()


def _migrate_edit_history():
    """Migrate database to add edit history tracking."""
    try:
        with engine.connect() as connection:
            # Check if updated_at column exists
            result = connection.execute(text("PRAGMA table_info(medication_assignments)"))
            columns = [row[1] for row in result.fetchall()]
            
            if 'updated_at' not in columns:
                # SQLite doesn't support DEFAULT CURRENT_TIMESTAMP in ALTER TABLE
                # Add column without default, then set values
                connection.execute(text("""
                    ALTER TABLE medication_assignments 
                    ADD COLUMN updated_at DATETIME
                """))
                connection.execute(text("""
                    UPDATE medication_assignments 
                    SET updated_at = created_at 
                    WHERE updated_at IS NULL
                """))
                connection.commit()
            
            # Check if assignment_audit_logs table exists
            result = connection.execute(text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='assignment_audit_logs'
            """))
            
            if result.fetchone() is None:
                connection.execute(text("""
                    CREATE TABLE assignment_audit_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        assignment_id INTEGER NOT NULL,
                        field_name VARCHAR NOT NULL,
                        old_value TEXT,
                        new_value TEXT,
                        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (assignment_id) REFERENCES medication_assignments(id)
                    )
                """))
                connection.execute(text("""
                    CREATE INDEX ix_assignment_audit_logs_assignment_id 
                    ON assignment_audit_logs(assignment_id)
                """))
                connection.execute(text("""
                    CREATE INDEX ix_assignment_audit_logs_changed_at 
                    ON assignment_audit_logs(changed_at)
                """))
                connection.commit()
    except Exception as e:
        # If migration fails, log but don't crash - tables will be created by create_all
        print(f"Migration note: {e}")

