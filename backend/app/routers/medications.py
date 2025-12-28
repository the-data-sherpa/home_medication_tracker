"""Medication management endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/medications", tags=["medications"])


@router.get("", response_model=List[schemas.Medication])
def get_medications(db: Session = Depends(get_db)):
    """Get all medications."""
    return db.query(models.Medication).all()


@router.post("", response_model=schemas.Medication, status_code=201)
def create_medication(medication: schemas.MedicationCreate, db: Session = Depends(get_db)):
    """Create a new medication."""
    try:
        db_medication = models.Medication(**medication.model_dump())
        db.add(db_medication)
        db.commit()
        db.refresh(db_medication)
        return db_medication
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create medication: {str(e)}")


@router.get("/{medication_id}", response_model=schemas.Medication)
def get_medication(medication_id: int, db: Session = Depends(get_db)):
    """Get a specific medication."""
    db_medication = db.query(models.Medication).filter(models.Medication.id == medication_id).first()
    if not db_medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    return db_medication


@router.put("/{medication_id}", response_model=schemas.Medication)
def update_medication(medication_id: int, medication: schemas.MedicationUpdate, db: Session = Depends(get_db)):
    """Update a medication."""
    db_medication = db.query(models.Medication).filter(models.Medication.id == medication_id).first()
    if not db_medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    try:
        update_data = medication.model_dump(exclude_unset=True)
        
        # Validate frequency if being updated
        if any(k in update_data for k in ['default_frequency_hours', 'default_frequency_min_hours', 'default_frequency_max_hours']):
            # Create a temporary object to validate
            temp_data = {
                'name': db_medication.name,
                'default_dose': db_medication.default_dose,
                'default_frequency_hours': update_data.get('default_frequency_hours', db_medication.default_frequency_hours),
                'default_frequency_min_hours': update_data.get('default_frequency_min_hours', db_medication.default_frequency_min_hours),
                'default_frequency_max_hours': update_data.get('default_frequency_max_hours', db_medication.default_frequency_max_hours),
            }
            # Validate using schema
            schemas.MedicationBase(**temp_data)
        
        for field, value in update_data.items():
            setattr(db_medication, field, value)
        
        db.commit()
        db.refresh(db_medication)
        return db_medication
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update medication: {str(e)}")


@router.get("/{medication_id}/can-delete")
def can_delete_medication(medication_id: int, db: Session = Depends(get_db)):
    """Check if a medication can be deleted (no assignments or inventory records)."""
    db_medication = db.query(models.Medication).filter(models.Medication.id == medication_id).first()
    if not db_medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    # Check for ALL assignments (active and inactive) - database constraint prevents deletion if any exist
    all_assignments = db.query(models.MedicationAssignment).options(
        joinedload(models.MedicationAssignment.family_member)
    ).filter(
        models.MedicationAssignment.medication_id == medication_id
    ).all()
    
    assignment_details = [
        {
            "id": assignment.id,
            "family_member_name": assignment.family_member.name if assignment.family_member else "Unknown",
            "active": assignment.active
        }
        for assignment in all_assignments
    ]
    
    # Check for inventory records - database constraint prevents deletion if any exist
    inventory = db.query(models.MedicationInventory).filter(
        models.MedicationInventory.medication_id == medication_id
    ).first()
    
    has_inventory = inventory is not None
    
    can_delete = len(all_assignments) == 0 and not has_inventory
    
    response = {
        "can_delete": can_delete,
        "assignments": assignment_details,
        "assignment_count": len(all_assignments),
        "has_inventory": has_inventory
    }
    
    # Keep backward compatibility with active_assignments for frontend
    active_assignments = [a for a in assignment_details if a["active"]]
    response["active_assignments"] = active_assignments
    response["count"] = len(active_assignments)
    
    return response


@router.delete("/{medication_id}", status_code=204)
def delete_medication(medication_id: int, db: Session = Depends(get_db)):
    """Delete a medication."""
    db_medication = db.query(models.Medication).filter(models.Medication.id == medication_id).first()
    if not db_medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    # Check for ALL assignments (active and inactive) - database constraint prevents deletion if any exist
    all_assignments = db.query(models.MedicationAssignment).options(
        joinedload(models.MedicationAssignment.family_member)
    ).filter(
        models.MedicationAssignment.medication_id == medication_id
    ).all()
    
    # Check for inventory records - database constraint prevents deletion if any exist
    inventory = db.query(models.MedicationInventory).filter(
        models.MedicationInventory.medication_id == medication_id
    ).first()
    
    # Build error details if deletion is blocked
    if all_assignments or inventory:
        assignment_details = [
            {
                "id": assignment.id,
                "family_member_name": assignment.family_member.name if assignment.family_member else "Unknown",
                "active": assignment.active
            }
            for assignment in all_assignments
        ]
        
        error_details = {
            "message": "Cannot delete medication with existing assignments or inventory records"
        }
        
        if all_assignments:
            error_details["assignments"] = assignment_details
            error_details["assignment_count"] = len(all_assignments)
            active_count = sum(1 for a in all_assignments if a.active)
            error_details["active_assignment_count"] = active_count
        
        if inventory:
            error_details["has_inventory"] = True
        
        raise HTTPException(status_code=400, detail=error_details)
    
    db.delete(db_medication)
    db.commit()
    return None

