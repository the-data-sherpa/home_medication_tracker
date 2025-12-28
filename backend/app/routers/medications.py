"""Medication management endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
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


@router.delete("/{medication_id}", status_code=204)
def delete_medication(medication_id: int, db: Session = Depends(get_db)):
    """Delete a medication."""
    db_medication = db.query(models.Medication).filter(models.Medication.id == medication_id).first()
    if not db_medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    db.delete(db_medication)
    db.commit()
    return None

