"""Caregiver management endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/caregivers", tags=["caregivers"])


@router.get("", response_model=List[schemas.Caregiver])
def get_caregivers(db: Session = Depends(get_db)):
    """Get all caregivers."""
    return db.query(models.Caregiver).filter(models.Caregiver.active == True).all()


@router.post("", response_model=schemas.Caregiver, status_code=201)
def create_caregiver(caregiver: schemas.CaregiverCreate, db: Session = Depends(get_db)):
    """Create a new caregiver."""
    db_caregiver = models.Caregiver(**caregiver.model_dump())
    db.add(db_caregiver)
    db.commit()
    db.refresh(db_caregiver)
    return db_caregiver


@router.put("/{caregiver_id}", response_model=schemas.Caregiver)
def update_caregiver(caregiver_id: int, caregiver: schemas.CaregiverUpdate, db: Session = Depends(get_db)):
    """Update a caregiver."""
    db_caregiver = db.query(models.Caregiver).filter(models.Caregiver.id == caregiver_id).first()
    if not db_caregiver:
        raise HTTPException(status_code=404, detail="Caregiver not found")
    
    update_data = caregiver.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_caregiver, field, value)
    
    db.commit()
    db.refresh(db_caregiver)
    return db_caregiver


@router.delete("/{caregiver_id}", status_code=204)
def delete_caregiver(caregiver_id: int, db: Session = Depends(get_db)):
    """Delete (deactivate) a caregiver."""
    db_caregiver = db.query(models.Caregiver).filter(models.Caregiver.id == caregiver_id).first()
    if not db_caregiver:
        raise HTTPException(status_code=404, detail="Caregiver not found")
    
    db_caregiver.active = False
    db.commit()
    return None

