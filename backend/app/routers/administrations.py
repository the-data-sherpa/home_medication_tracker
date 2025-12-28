"""Medication administration tracking endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/administrations", tags=["administrations"])


@router.get("", response_model=List[schemas.Administration])
def get_administrations(
    assignment_id: Optional[int] = None,
    family_member_id: Optional[int] = None,
    medication_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get administration records with optional filtering."""
    query = db.query(models.Administration)
    
    if assignment_id:
        query = query.filter(models.Administration.medication_assignment_id == assignment_id)
    elif family_member_id or medication_id:
        # Join with assignments to filter by family member or medication
        query = query.join(models.MedicationAssignment)
        if family_member_id:
            query = query.filter(models.MedicationAssignment.family_member_id == family_member_id)
        if medication_id:
            query = query.filter(models.MedicationAssignment.medication_id == medication_id)
    
    if start_date:
        start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        query = query.filter(models.Administration.administered_at >= start_dt)
    
    if end_date:
        end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        query = query.filter(models.Administration.administered_at <= end_dt)
    
    query = query.order_by(desc(models.Administration.administered_at))
    
    if limit:
        query = query.limit(limit)
    
    # Eager load relationships
    from sqlalchemy.orm import joinedload
    query = query.options(
        joinedload(models.Administration.assignment).joinedload(models.MedicationAssignment.medication),
        joinedload(models.Administration.assignment).joinedload(models.MedicationAssignment.family_member),
        joinedload(models.Administration.caregiver)
    )
    
    return query.all()


@router.post("", response_model=schemas.Administration, status_code=201)
def create_administration(administration: schemas.AdministrationCreate, db: Session = Depends(get_db)):
    """Record a medication administration."""
    # Verify assignment exists
    assignment = db.query(models.MedicationAssignment).filter(
        models.MedicationAssignment.id == administration.medication_assignment_id
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Verify caregiver exists if provided
    if administration.caregiver_id:
        caregiver = db.query(models.Caregiver).filter(
            models.Caregiver.id == administration.caregiver_id,
            models.Caregiver.active == True
        ).first()
        if not caregiver:
            raise HTTPException(status_code=404, detail="Caregiver not found")
    
    # Handle administered_at time (for backdating)
    if administration.administered_at:
        # Parse and validate the datetime
        if isinstance(administration.administered_at, str):
            # Parse ISO string - if it has timezone info, use it; otherwise assume UTC
            dt_str = administration.administered_at
            if dt_str.endswith('Z'):
                dt_str = dt_str.replace('Z', '+00:00')
            try:
                dt = datetime.fromisoformat(dt_str)
                # If no timezone info, assume it's UTC
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                else:
                    # Convert to UTC
                    dt = dt.astimezone(timezone.utc)
                administered_at = dt
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid datetime format")
        else:
            administered_at = administration.administered_at
            # Ensure datetime is timezone-aware and in UTC
            if administered_at.tzinfo is None:
                administered_at = administered_at.replace(tzinfo=timezone.utc)
            else:
                administered_at = administered_at.astimezone(timezone.utc)
        
        # Validate not in future
        now_utc = datetime.now(timezone.utc)
        if administered_at > now_utc:
            raise HTTPException(status_code=400, detail="Administration time cannot be in the future")
        
        # Validate not more than 24 hours in the past
        max_backdate = timedelta(hours=24)
        if administered_at < (now_utc - max_backdate):
            raise HTTPException(
                status_code=400, 
                detail="Administration time cannot be more than 24 hours in the past"
            )
    else:
        # Default to current time if not provided
        administered_at = datetime.now(timezone.utc)
    
    # Create administration
    db_administration = models.Administration(
        medication_assignment_id=administration.medication_assignment_id,
        caregiver_id=administration.caregiver_id,
        administered_at=administered_at,
        dose_given=administration.dose_given,
        notes=administration.notes
    )
    db.add(db_administration)
    db.commit()
    db.refresh(db_administration)
    return db_administration


@router.get("/{administration_id}", response_model=schemas.Administration)
def get_administration(administration_id: int, db: Session = Depends(get_db)):
    """Get a specific administration record."""
    db_administration = db.query(models.Administration).filter(
        models.Administration.id == administration_id
    ).first()
    if not db_administration:
        raise HTTPException(status_code=404, detail="Administration not found")
    return db_administration


@router.put("/{administration_id}", response_model=schemas.Administration)
def update_administration(
    administration_id: int,
    administration: schemas.AdministrationUpdate,
    db: Session = Depends(get_db)
):
    """Update an administration record (timestamp, dose, caregiver, notes)."""
    db_administration = db.query(models.Administration).filter(
        models.Administration.id == administration_id
    ).first()
    if not db_administration:
        raise HTTPException(status_code=404, detail="Administration not found")
    
    try:
        update_data = administration.model_dump(exclude_unset=True)
        
        # Validate caregiver if provided
        if 'caregiver_id' in update_data and update_data['caregiver_id'] is not None:
            caregiver = db.query(models.Caregiver).filter(
                models.Caregiver.id == update_data['caregiver_id'],
                models.Caregiver.active == True
            ).first()
            if not caregiver:
                raise HTTPException(status_code=404, detail="Caregiver not found")
        
        # Validate and convert administered_at to UTC
        if 'administered_at' in update_data and update_data['administered_at']:
            if isinstance(update_data['administered_at'], str):
                # Parse ISO string - if it has timezone info, use it; otherwise assume UTC
                dt_str = update_data['administered_at']
                if dt_str.endswith('Z'):
                    dt_str = dt_str.replace('Z', '+00:00')
                try:
                    dt = datetime.fromisoformat(dt_str)
                    # If no timezone info, assume it's UTC
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    else:
                        # Convert to UTC
                        dt = dt.astimezone(timezone.utc)
                    update_data['administered_at'] = dt
                except ValueError:
                    raise HTTPException(status_code=400, detail="Invalid datetime format")
            # Ensure datetime is timezone-aware and in UTC
            if isinstance(update_data['administered_at'], datetime):
                if update_data['administered_at'].tzinfo is None:
                    update_data['administered_at'] = update_data['administered_at'].replace(tzinfo=timezone.utc)
                else:
                    update_data['administered_at'] = update_data['administered_at'].astimezone(timezone.utc)
            # Validate not in future (using UTC)
            if update_data['administered_at'] > datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="Administration time cannot be in the future")
        
        for field, value in update_data.items():
            setattr(db_administration, field, value)
        
        db.commit()
        db.refresh(db_administration)
        return db_administration
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Invalid datetime format: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update administration: {str(e)}")


@router.delete("/{administration_id}", status_code=204)
def delete_administration(administration_id: int, db: Session = Depends(get_db)):
    """Delete an administration record."""
    db_administration = db.query(models.Administration).filter(
        models.Administration.id == administration_id
    ).first()
    if not db_administration:
        raise HTTPException(status_code=404, detail="Administration not found")
    
    db.delete(db_administration)
    db.commit()
    return None

