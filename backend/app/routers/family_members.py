"""Family member management endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/family-members", tags=["family-members"])


@router.get("", response_model=List[schemas.FamilyMember])
def get_family_members(db: Session = Depends(get_db)):
    """Get all family members."""
    return db.query(models.FamilyMember).filter(models.FamilyMember.active == True).all()


@router.post("", response_model=schemas.FamilyMember, status_code=201)
def create_family_member(member: schemas.FamilyMemberCreate, db: Session = Depends(get_db)):
    """Create a new family member."""
    db_member = models.FamilyMember(**member.model_dump())
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member


@router.put("/{member_id}", response_model=schemas.FamilyMember)
def update_family_member(member_id: int, member: schemas.FamilyMemberUpdate, db: Session = Depends(get_db)):
    """Update a family member."""
    db_member = db.query(models.FamilyMember).filter(models.FamilyMember.id == member_id).first()
    if not db_member:
        raise HTTPException(status_code=404, detail="Family member not found")
    
    update_data = member.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_member, field, value)
    
    db.commit()
    db.refresh(db_member)
    return db_member


@router.delete("/{member_id}", status_code=204)
def delete_family_member(member_id: int, db: Session = Depends(get_db)):
    """Delete (deactivate) a family member."""
    db_member = db.query(models.FamilyMember).filter(models.FamilyMember.id == member_id).first()
    if not db_member:
        raise HTTPException(status_code=404, detail="Family member not found")
    
    db_member.active = False
    db.commit()
    return None

