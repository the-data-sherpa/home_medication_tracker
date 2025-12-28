#!/usr/bin/env python3
"""Migration script to add edit history tracking to assignments.

This script:
1. Adds updated_at column to medication_assignments table
2. Creates assignment_audit_logs table

Run this script once to migrate existing databases.
"""
import os
import sys
import sqlite3
from pathlib import Path

# Get database path from environment or use default
DATABASE_PATH = os.getenv("DATABASE_PATH", "/app/data/medications.db")

# For local development, try relative path
if not os.path.exists(DATABASE_PATH):
    local_path = Path(__file__).parent.parent / "data" / "medications.db"
    if local_path.exists():
        DATABASE_PATH = str(local_path)
    else:
        print(f"Error: Database not found at {DATABASE_PATH} or {local_path}")
        sys.exit(1)

print(f"Migrating database at: {DATABASE_PATH}")

conn = sqlite3.connect(DATABASE_PATH)
cursor = conn.cursor()

try:
    # Check if updated_at column already exists
    cursor.execute("PRAGMA table_info(medication_assignments)")
    columns = [row[1] for row in cursor.fetchall()]
    
    if 'updated_at' not in columns:
        print("Adding updated_at column to medication_assignments table...")
        cursor.execute("""
            ALTER TABLE medication_assignments 
            ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        """)
        # Set initial value for existing rows
        cursor.execute("""
            UPDATE medication_assignments 
            SET updated_at = created_at 
            WHERE updated_at IS NULL
        """)
        print("✓ Added updated_at column")
    else:
        print("✓ updated_at column already exists")
    
    # Check if assignment_audit_logs table exists
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='assignment_audit_logs'
    """)
    
    if cursor.fetchone() is None:
        print("Creating assignment_audit_logs table...")
        cursor.execute("""
            CREATE TABLE assignment_audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                assignment_id INTEGER NOT NULL,
                field_name VARCHAR NOT NULL,
                old_value TEXT,
                new_value TEXT,
                changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (assignment_id) REFERENCES medication_assignments(id)
            )
        """)
        # Create indexes
        cursor.execute("""
            CREATE INDEX ix_assignment_audit_logs_assignment_id 
            ON assignment_audit_logs(assignment_id)
        """)
        cursor.execute("""
            CREATE INDEX ix_assignment_audit_logs_changed_at 
            ON assignment_audit_logs(changed_at)
        """)
        print("✓ Created assignment_audit_logs table")
    else:
        print("✓ assignment_audit_logs table already exists")
    
    conn.commit()
    print("\n✓ Migration completed successfully!")
    
except sqlite3.Error as e:
    conn.rollback()
    print(f"\n✗ Migration failed: {e}")
    sys.exit(1)
finally:
    conn.close()
