"""Medication assignment management endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/assignments", tags=["assignments"])


@router.get("", response_model=List[schemas.MedicationAssignment])
def get_assignments(
    family_member_id: Optional[int] = None,
    active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Get medication assignments, optionally filtered by family member."""
    query = db.query(models.MedicationAssignment)
    
    if family_member_id:
        query = query.filter(models.MedicationAssignment.family_member_id == family_member_id)
    
    if active is not None:
        query = query.filter(models.MedicationAssignment.active == active)
    
    return query.all()


@router.post("", response_model=schemas.MedicationAssignment, status_code=201)
def create_assignment(assignment: schemas.MedicationAssignmentCreate, db: Session = Depends(get_db)):
    """Create a new medication assignment."""
    # Verify family member exists
    family_member = db.query(models.FamilyMember).filter(
        models.FamilyMember.id == assignment.family_member_id,
        models.FamilyMember.active == True
    ).first()
    if not family_member:
        raise HTTPException(status_code=404, detail="Family member not found")
    
    # Verify medication exists
    medication = db.query(models.Medication).filter(
        models.Medication.id == assignment.medication_id
    ).first()
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    # Check for existing assignment (active or inactive) with same medication + family member
    existing_assignment = db.query(models.MedicationAssignment).filter(
        models.MedicationAssignment.family_member_id == assignment.family_member_id,
        models.MedicationAssignment.medication_id == assignment.medication_id
    ).first()
    
    if existing_assignment:
        # Return error with details about existing assignment (whether active or inactive)
        message = "An active assignment already exists for this medication and family member" if existing_assignment.active else "An inactive assignment exists for this medication and family member. Would you like to reactivate it?"
        raise HTTPException(
            status_code=409,  # Conflict status code
            detail={
                "message": message,
                "existing_assignment_id": existing_assignment.id,
                "family_member_name": family_member.name,
                "medication_name": medication.name,
                "is_active": existing_assignment.active
            }
        )
    
    try:
        db_assignment = models.MedicationAssignment(**assignment.model_dump())
        db.add(db_assignment)
        db.commit()
        db.refresh(db_assignment)
        return db_assignment
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create assignment: {str(e)}")


@router.get("/{assignment_id}", response_model=schemas.MedicationAssignment)
def get_assignment(assignment_id: int, db: Session = Depends(get_db)):
    """Get a specific assignment."""
    db_assignment = db.query(models.MedicationAssignment).filter(
        models.MedicationAssignment.id == assignment_id
    ).first()
    if not db_assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return db_assignment


@router.put("/{assignment_id}", response_model=schemas.MedicationAssignment)
def update_assignment(
    assignment_id: int,
    assignment: schemas.MedicationAssignmentUpdate,
    db: Session = Depends(get_db)
):
    """Update a medication assignment."""
    db_assignment = db.query(models.MedicationAssignment).filter(
        models.MedicationAssignment.id == assignment_id
    ).first()
    if not db_assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    try:
        update_data = assignment.model_dump(exclude_unset=True)
        
        # Validate frequency override if being updated
        if any(k in update_data for k in ['frequency_hours', 'frequency_min_hours', 'frequency_max_hours']):
            temp_data = {
                'family_member_id': db_assignment.family_member_id,
                'medication_id': db_assignment.medication_id,
                'frequency_hours': update_data.get('frequency_hours', db_assignment.frequency_hours),
                'frequency_min_hours': update_data.get('frequency_min_hours', db_assignment.frequency_min_hours),
                'frequency_max_hours': update_data.get('frequency_max_hours', db_assignment.frequency_max_hours),
            }
            schemas.MedicationAssignmentBase(**temp_data)
        
        # Track changes for audit log
        audit_logs = []
        for field, new_value in update_data.items():
            old_value = getattr(db_assignment, field, None)
            
            # Convert values to strings for comparison and storage
            old_str = str(old_value) if old_value is not None else None
            new_str = str(new_value) if new_value is not None else None
            
            # Only log if value actually changed
            if old_str != new_str:
                audit_logs.append(models.AssignmentAuditLog(
                    assignment_id=assignment_id,
                    field_name=field,
                    old_value=old_str,
                    new_value=new_str
                ))
            setattr(db_assignment, field, new_value)
        
        # Save audit logs
        if audit_logs:
            db.add_all(audit_logs)
        
        db.commit()
        db.refresh(db_assignment)
        return db_assignment
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update assignment: {str(e)}")


@router.delete("/{assignment_id}", status_code=204)
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    """Delete (deactivate) a medication assignment."""
    db_assignment = db.query(models.MedicationAssignment).filter(
        models.MedicationAssignment.id == assignment_id
    ).first()
    if not db_assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    db_assignment.active = False
    db.commit()
    return None


@router.get("/{assignment_id}/can-administer", response_model=schemas.AssignmentStatus)
def can_administer(assignment_id: int, db: Session = Depends(get_db)):
    """Check if medication can be administered and get status."""
    db_assignment = db.query(models.MedicationAssignment).filter(
        models.MedicationAssignment.id == assignment_id
    ).first()
    if not db_assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Determine frequency type and values
    # Check if assignment has range override
    has_range_override = (db_assignment.frequency_min_hours is not None and 
                          db_assignment.frequency_max_hours is not None)
    has_fixed_override = db_assignment.frequency_hours is not None
    
    # Check medication defaults
    med_has_range = (db_assignment.medication.default_frequency_min_hours is not None and
                     db_assignment.medication.default_frequency_max_hours is not None)
    med_has_fixed = db_assignment.medication.default_frequency_hours is not None
    
    # Determine frequency type
    if has_range_override or (not has_fixed_override and med_has_range):
        # Range frequency
        frequency_type = "range"
        min_hours = db_assignment.frequency_min_hours or db_assignment.medication.default_frequency_min_hours
        max_hours = db_assignment.frequency_max_hours or db_assignment.medication.default_frequency_max_hours
        frequency_hours = None
        if min_hours is None or max_hours is None:
            raise HTTPException(status_code=400, detail="Medication range frequency not properly configured")
    else:
        # Fixed frequency
        frequency_type = "fixed"
        frequency_hours = db_assignment.frequency_hours or db_assignment.medication.default_frequency_hours
        min_hours = None
        max_hours = None
        if frequency_hours is None:
            raise HTTPException(status_code=400, detail="Medication frequency not properly configured")
    
    # Get last administration
    last_admin = db.query(models.Administration).filter(
        models.Administration.medication_assignment_id == assignment_id
    ).order_by(desc(models.Administration.administered_at)).first()
    
    if not last_admin:
        return schemas.AssignmentStatus(
            can_administer=True,
            status="ready",
            last_administration=None,
            next_dose_time=None,
            next_dose_max_time=None,
            frequency_type=frequency_type
        )
    
    last_time = last_admin.administered_at
    if isinstance(last_time, str):
        last_time = datetime.fromisoformat(last_time.replace('Z', '+00:00'))
    
    # Ensure last_time is timezone-aware (UTC)
    if last_time.tzinfo is None:
        last_time = last_time.replace(tzinfo=timezone.utc)
    else:
        last_time = last_time.astimezone(timezone.utc)
    
    # Use UTC for now
    now = datetime.now(timezone.utc)
    
    if frequency_type == "range":
        # Range frequency logic
        next_dose_min_time = last_time + timedelta(hours=min_hours)
        next_dose_max_time = last_time + timedelta(hours=max_hours)
        
        time_until_min = (next_dose_min_time - now).total_seconds() / 3600
        time_until_max = (next_dose_max_time - now).total_seconds() / 3600
        
        if now >= next_dose_max_time:
            # Past max hours - overdue
            status = "overdue"
            can_administer = True
        elif now >= next_dose_min_time:
            # Past min hours - ready to give
            status = "ready"
            can_administer = True
        elif time_until_min <= 1:
            # Within 1 hour of min - soon
            status = "soon"
            can_administer = False
        else:
            # More than 1 hour until min - not ready yet
            status = "ready"
            can_administer = False
        
        return schemas.AssignmentStatus(
            can_administer=can_administer,
            time_until_next=time_until_min if not can_administer else None,
            time_until_max=time_until_max if now < next_dose_max_time else None,
            status=status,
            last_administration=last_time,
            next_dose_time=next_dose_min_time,
            next_dose_max_time=next_dose_max_time,
            frequency_type=frequency_type
        )
    else:
        # Fixed frequency logic
        next_dose_time = last_time + timedelta(hours=frequency_hours)
        time_until_next = (next_dose_time - now).total_seconds() / 3600
        
        if now >= next_dose_time:
            # Can administer now (overdue or exactly on time)
            status = "ready"
            can_administer = True
        elif time_until_next <= 1:
            # Within 1 hour
            status = "soon"
            can_administer = False
        else:
            # More than 1 hour away - not ready yet
            status = "ready"
            can_administer = False
        
        return schemas.AssignmentStatus(
            can_administer=can_administer,
            time_until_next=time_until_next if not can_administer else None,
            time_until_max=None,
            status=status,
            last_administration=last_time,
            next_dose_time=next_dose_time,
            next_dose_max_time=None,
            frequency_type=frequency_type
        )


@router.get("/{assignment_id}/status", response_model=schemas.AssignmentStatus)
def get_assignment_status(assignment_id: int, db: Session = Depends(get_db)):
    """Get detailed status of an assignment."""
    return can_administer(assignment_id, db)


@router.get("/scheduled/list", response_model=List[schemas.MedicationAssignment])
def get_scheduled_assignments(db: Session = Depends(get_db)):
    """Get all assignments with recurring schedules."""
    return db.query(models.MedicationAssignment).filter(
        models.MedicationAssignment.schedule_type.isnot(None),
        models.MedicationAssignment.active == True
    ).all()


@router.get("/{assignment_id}/edit-history", response_model=List[schemas.AssignmentAuditLog])
def get_assignment_edit_history(assignment_id: int, db: Session = Depends(get_db)):
    """Get edit history for an assignment."""
    # Verify assignment exists
    db_assignment = db.query(models.MedicationAssignment).filter(
        models.MedicationAssignment.id == assignment_id
    ).first()
    if not db_assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Get audit logs
    audit_logs = db.query(models.AssignmentAuditLog).filter(
        models.AssignmentAuditLog.assignment_id == assignment_id
    ).order_by(models.AssignmentAuditLog.changed_at.desc()).all()
    
    return audit_logs

