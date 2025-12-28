"""Medication inventory management endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/inventory", tags=["inventory"])


@router.get("", response_model=List[schemas.MedicationInventory])
def get_inventory(db: Session = Depends(get_db)):
    """Get all medication inventory records."""
    return db.query(models.MedicationInventory).all()


@router.get("/low-stock", response_model=List[schemas.MedicationInventory])
def get_low_stock(db: Session = Depends(get_db)):
    """Get medications with low stock."""
    inventory_items = db.query(models.MedicationInventory).all()
    low_stock = []
    
    for item in inventory_items:
        if item.low_stock_threshold and item.quantity <= item.low_stock_threshold:
            low_stock.append(item)
    
    return low_stock


@router.post("", response_model=schemas.MedicationInventory, status_code=201)
def create_inventory(inventory: schemas.MedicationInventoryCreate, db: Session = Depends(get_db)):
    """Create or update inventory for a medication."""
    # Check if inventory already exists
    existing = db.query(models.MedicationInventory).filter(
        models.MedicationInventory.medication_id == inventory.medication_id
    ).first()
    
    if existing:
        # Update existing
        update_data = inventory.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(existing, field, value)
        db.commit()
        db.refresh(existing)
        return existing
    
    # Verify medication exists
    medication = db.query(models.Medication).filter(
        models.Medication.id == inventory.medication_id
    ).first()
    if not medication:
        raise HTTPException(status_code=404, detail="Medication not found")
    
    db_inventory = models.MedicationInventory(**inventory.model_dump())
    db.add(db_inventory)
    db.commit()
    db.refresh(db_inventory)
    return db_inventory


@router.get("/{inventory_id}", response_model=schemas.MedicationInventory)
def get_inventory_item(inventory_id: int, db: Session = Depends(get_db)):
    """Get a specific inventory record."""
    db_inventory = db.query(models.MedicationInventory).filter(
        models.MedicationInventory.id == inventory_id
    ).first()
    if not db_inventory:
        raise HTTPException(status_code=404, detail="Inventory record not found")
    return db_inventory


@router.put("/{inventory_id}", response_model=schemas.MedicationInventory)
def update_inventory(
    inventory_id: int,
    inventory: schemas.MedicationInventoryUpdate,
    db: Session = Depends(get_db)
):
    """Update an inventory record."""
    db_inventory = db.query(models.MedicationInventory).filter(
        models.MedicationInventory.id == inventory_id
    ).first()
    if not db_inventory:
        raise HTTPException(status_code=404, detail="Inventory record not found")
    
    update_data = inventory.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_inventory, field, value)
    
    db.commit()
    db.refresh(db_inventory)
    return db_inventory


@router.delete("/{inventory_id}", status_code=204)
def delete_inventory(inventory_id: int, db: Session = Depends(get_db)):
    """Delete an inventory record."""
    db_inventory = db.query(models.MedicationInventory).filter(
        models.MedicationInventory.id == inventory_id
    ).first()
    if not db_inventory:
        raise HTTPException(status_code=404, detail="Inventory record not found")
    
    db.delete(db_inventory)
    db.commit()
    return None

