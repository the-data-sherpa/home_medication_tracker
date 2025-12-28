"""Export and import functionality."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import Dict, Any
import json
import csv
import io
from datetime import datetime, timezone
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/export", tags=["export"])


def serialize_datetime(obj):
    """JSON serializer for datetime objects."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


@router.get("/json")
def export_json(db: Session = Depends(get_db)):
    """Export all data as JSON."""
    data = {
        "export_date": datetime.now().isoformat(),
        "family_members": [],
        "caregivers": [],
        "medications": [],
        "assignments": [],
        "administrations": [],
        "inventory": []
    }
    
    # Export family members
    family_members = db.query(models.FamilyMember).all()
    for member in family_members:
        data["family_members"].append({
            "id": member.id,
            "name": member.name,
            "active": member.active,
            "created_at": member.created_at.isoformat() if member.created_at else None
        })
    
    # Export caregivers
    caregivers = db.query(models.Caregiver).all()
    for caregiver in caregivers:
        data["caregivers"].append({
            "id": caregiver.id,
            "name": caregiver.name,
            "active": caregiver.active,
            "created_at": caregiver.created_at.isoformat() if caregiver.created_at else None
        })
    
    # Export medications
    medications = db.query(models.Medication).all()
    for med in medications:
        data["medications"].append({
            "id": med.id,
            "name": med.name,
            "default_dose": med.default_dose,
            "default_frequency_hours": med.default_frequency_hours,
            "default_frequency_min_hours": med.default_frequency_min_hours,
            "default_frequency_max_hours": med.default_frequency_max_hours,
            "notes": med.notes,
            "created_at": med.created_at.isoformat() if med.created_at else None
        })
    
    # Export assignments
    assignments = db.query(models.MedicationAssignment).all()
    for assignment in assignments:
        data["assignments"].append({
            "id": assignment.id,
            "family_member_id": assignment.family_member_id,
            "medication_id": assignment.medication_id,
            "current_dose": assignment.current_dose,
            "frequency_hours": assignment.frequency_hours,
            "frequency_min_hours": assignment.frequency_min_hours,
            "frequency_max_hours": assignment.frequency_max_hours,
            "active": assignment.active,
            "schedule_type": assignment.schedule_type,
            "schedule_time": assignment.schedule_time,
            "schedule_days": assignment.schedule_days,
            "created_at": assignment.created_at.isoformat() if assignment.created_at else None
        })
    
    # Export administrations
    administrations = db.query(models.Administration).all()
    for admin in administrations:
        data["administrations"].append({
            "id": admin.id,
            "medication_assignment_id": admin.medication_assignment_id,
            "caregiver_id": admin.caregiver_id,
            "administered_at": admin.administered_at.isoformat() if admin.administered_at else None,
            "dose_given": admin.dose_given,
            "notes": admin.notes,
            "created_at": admin.created_at.isoformat() if admin.created_at else None
        })
    
    # Export inventory
    inventory = db.query(models.MedicationInventory).all()
    for inv in inventory:
        data["inventory"].append({
            "id": inv.id,
            "medication_id": inv.medication_id,
            "quantity": inv.quantity,
            "unit": inv.unit,
            "low_stock_threshold": inv.low_stock_threshold,
            "last_updated": inv.last_updated.isoformat() if inv.last_updated else None
        })
    
    return JSONResponse(content=data)


@router.get("/csv")
def export_csv(db: Session = Depends(get_db)):
    """Export administrations as CSV."""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        "ID", "Family Member", "Medication", "Caregiver", "Administered At", "Dose Given", "Notes"
    ])
    
    # Write data
    from sqlalchemy.orm import joinedload
    administrations = db.query(models.Administration).join(
        models.MedicationAssignment
    ).join(
        models.FamilyMember
    ).join(
        models.Medication
    ).options(
        joinedload(models.Administration.caregiver)
    ).order_by(models.Administration.administered_at.desc()).all()
    
    for admin in administrations:
        caregiver_name = admin.caregiver.name if admin.caregiver else ""
        writer.writerow([
            admin.id,
            admin.assignment.family_member.name,
            admin.assignment.medication.name,
            caregiver_name,
            admin.administered_at.isoformat() if admin.administered_at else "",
            admin.dose_given,
            admin.notes or ""
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=medication_export.csv"}
    )


@router.post("/import/json")
def import_json(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Import data from JSON backup."""
    try:
        content = file.file.read()
        data = json.loads(content)
        
        imported = {
            "family_members": 0,
            "caregivers": 0,
            "medications": 0,
            "assignments": 0,
            "administrations": 0,
            "inventory": 0
        }
        
        # Import family members
        if "family_members" in data:
            for member_data in data["family_members"]:
                existing = db.query(models.FamilyMember).filter(
                    models.FamilyMember.id == member_data["id"]
                ).first()
                if not existing:
                    db_member = models.FamilyMember(
                        id=member_data["id"],
                        name=member_data["name"],
                        active=member_data.get("active", True)
                    )
                    db.add(db_member)
                    imported["family_members"] += 1
        
        # Import caregivers
        if "caregivers" in data:
            for caregiver_data in data["caregivers"]:
                existing = db.query(models.Caregiver).filter(
                    models.Caregiver.id == caregiver_data["id"]
                ).first()
                if not existing:
                    db_caregiver = models.Caregiver(
                        id=caregiver_data["id"],
                        name=caregiver_data["name"],
                        active=caregiver_data.get("active", True)
                    )
                    db.add(db_caregiver)
                    imported["caregivers"] += 1
        
        # Import medications
        if "medications" in data:
            for med_data in data["medications"]:
                existing = db.query(models.Medication).filter(
                    models.Medication.id == med_data["id"]
                ).first()
                if not existing:
                    db_med = models.Medication(
                        id=med_data["id"],
                        name=med_data["name"],
                        default_dose=med_data["default_dose"],
                        default_frequency_hours=med_data.get("default_frequency_hours"),
                        default_frequency_min_hours=med_data.get("default_frequency_min_hours"),
                        default_frequency_max_hours=med_data.get("default_frequency_max_hours"),
                        notes=med_data.get("notes")
                    )
                    db.add(db_med)
                    imported["medications"] += 1
        
        # Import assignments
        if "assignments" in data:
            for assign_data in data["assignments"]:
                existing = db.query(models.MedicationAssignment).filter(
                    models.MedicationAssignment.id == assign_data["id"]
                ).first()
                if not existing:
                    db_assign = models.MedicationAssignment(
                        id=assign_data["id"],
                        family_member_id=assign_data["family_member_id"],
                        medication_id=assign_data["medication_id"],
                        current_dose=assign_data.get("current_dose"),
                        frequency_hours=assign_data.get("frequency_hours"),
                        frequency_min_hours=assign_data.get("frequency_min_hours"),
                        frequency_max_hours=assign_data.get("frequency_max_hours"),
                        active=assign_data.get("active", True),
                        schedule_type=assign_data.get("schedule_type"),
                        schedule_time=assign_data.get("schedule_time"),
                        schedule_days=assign_data.get("schedule_days")
                    )
                    db.add(db_assign)
                    imported["assignments"] += 1
        
        # Import administrations
        if "administrations" in data:
            for admin_data in data["administrations"]:
                existing = db.query(models.Administration).filter(
                    models.Administration.id == admin_data["id"]
                ).first()
                if not existing:
                    if admin_data.get("administered_at"):
                        admin_time = datetime.fromisoformat(admin_data["administered_at"].replace('Z', '+00:00'))
                        # Ensure UTC
                        if admin_time.tzinfo is None:
                            admin_time = admin_time.replace(tzinfo=timezone.utc)
                        else:
                            admin_time = admin_time.astimezone(timezone.utc)
                    else:
                        admin_time = datetime.now(timezone.utc)
                    db_admin = models.Administration(
                        id=admin_data["id"],
                        medication_assignment_id=admin_data["medication_assignment_id"],
                        caregiver_id=admin_data.get("caregiver_id"),
                        administered_at=admin_time,
                        dose_given=admin_data["dose_given"],
                        notes=admin_data.get("notes")
                    )
                    db.add(db_admin)
                    imported["administrations"] += 1
        
        # Import inventory
        if "inventory" in data:
            for inv_data in data["inventory"]:
                existing = db.query(models.MedicationInventory).filter(
                    models.MedicationInventory.id == inv_data["id"]
                ).first()
                if not existing:
                    db_inv = models.MedicationInventory(
                        id=inv_data["id"],
                        medication_id=inv_data["medication_id"],
                        quantity=inv_data["quantity"],
                        unit=inv_data["unit"],
                        low_stock_threshold=inv_data.get("low_stock_threshold")
                    )
                    db.add(db_inv)
                    imported["inventory"] += 1
        
        db.commit()
        
        return {
            "message": "Import completed successfully",
            "imported": imported
        }
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Import failed: {str(e)}")

