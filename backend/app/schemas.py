"""Pydantic schemas for request/response validation."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, field_validator, model_validator


# Family Member Schemas
class FamilyMemberBase(BaseModel):
    name: str
    active: bool = True


class FamilyMemberCreate(FamilyMemberBase):
    pass


class FamilyMemberUpdate(BaseModel):
    name: Optional[str] = None
    active: Optional[bool] = None


class FamilyMember(FamilyMemberBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Caregiver Schemas
class CaregiverBase(BaseModel):
    name: str
    active: bool = True


class CaregiverCreate(CaregiverBase):
    pass


class CaregiverUpdate(BaseModel):
    name: Optional[str] = None
    active: Optional[bool] = None


class Caregiver(CaregiverBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Medication Schemas
class MedicationBase(BaseModel):
    name: str
    default_dose: str
    default_frequency_hours: Optional[float] = None  # For fixed frequency
    default_frequency_min_hours: Optional[float] = None  # For range frequency
    default_frequency_max_hours: Optional[float] = None  # For range frequency
    notes: Optional[str] = None

    @model_validator(mode='after')
    def validate_frequency(self):
        """Ensure medication has either fixed or range frequency, and range min < max."""
        has_fixed = self.default_frequency_hours is not None
        has_range = (self.default_frequency_min_hours is not None and 
                     self.default_frequency_max_hours is not None)
        
        if not has_fixed and not has_range:
            raise ValueError("Medication must have either fixed frequency or range frequency")
        
        if has_fixed and has_range:
            raise ValueError("Medication cannot have both fixed and range frequency")
        
        if has_range:
            if self.default_frequency_min_hours >= self.default_frequency_max_hours:
                raise ValueError("Range minimum must be less than maximum")
            if self.default_frequency_min_hours <= 0 or self.default_frequency_max_hours <= 0:
                raise ValueError("Frequency hours must be greater than 0")
        
        if has_fixed and self.default_frequency_hours <= 0:
            raise ValueError("Frequency hours must be greater than 0")
        
        return self


class MedicationCreate(MedicationBase):
    pass


class MedicationUpdate(BaseModel):
    name: Optional[str] = None
    default_dose: Optional[str] = None
    default_frequency_hours: Optional[float] = None
    default_frequency_min_hours: Optional[float] = None
    default_frequency_max_hours: Optional[float] = None
    notes: Optional[str] = None


class Medication(MedicationBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Medication Assignment Schemas
class MedicationAssignmentBase(BaseModel):
    family_member_id: int
    medication_id: int
    current_dose: Optional[str] = None
    frequency_hours: Optional[float] = None  # For fixed frequency
    frequency_min_hours: Optional[float] = None  # For range frequency
    frequency_max_hours: Optional[float] = None  # For range frequency
    active: bool = True
    schedule_type: Optional[str] = None
    schedule_time: Optional[str] = None
    schedule_days: Optional[str] = None

    @model_validator(mode='after')
    def validate_frequency_override(self):
        """Validate frequency override if provided."""
        has_fixed = self.frequency_hours is not None
        has_range = (self.frequency_min_hours is not None and 
                     self.frequency_max_hours is not None)
        
        if has_fixed and has_range:
            raise ValueError("Assignment cannot have both fixed and range frequency override")
        
        if has_range:
            if self.frequency_min_hours >= self.frequency_max_hours:
                raise ValueError("Range minimum must be less than maximum")
            if self.frequency_min_hours <= 0 or self.frequency_max_hours <= 0:
                raise ValueError("Frequency hours must be greater than 0")
        
        if has_fixed and self.frequency_hours <= 0:
            raise ValueError("Frequency hours must be greater than 0")
        
        return self


class MedicationAssignmentCreate(MedicationAssignmentBase):
    pass


class MedicationAssignmentUpdate(BaseModel):
    current_dose: Optional[str] = None
    frequency_hours: Optional[float] = None
    frequency_min_hours: Optional[float] = None
    frequency_max_hours: Optional[float] = None
    active: Optional[bool] = None
    schedule_type: Optional[str] = None
    schedule_time: Optional[str] = None
    schedule_days: Optional[str] = None


class MedicationAssignment(MedicationAssignmentBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    family_member: FamilyMember
    medication: Medication

    class Config:
        from_attributes = True


class AssignmentAuditLog(BaseModel):
    """Audit log entry for assignment changes."""
    id: int
    assignment_id: int
    field_name: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_at: datetime

    class Config:
        from_attributes = True


class AssignmentStatus(BaseModel):
    can_administer: bool
    time_until_next: Optional[float] = None  # hours
    time_until_max: Optional[float] = None  # hours until max for range frequencies
    status: str  # "ready", "soon", "overdue"
    last_administration: Optional[datetime] = None
    next_dose_time: Optional[datetime] = None
    next_dose_max_time: Optional[datetime] = None  # Max time for range frequencies
    frequency_type: str  # "fixed" or "range"


# Administration Schemas
class AdministrationBase(BaseModel):
    medication_assignment_id: int
    caregiver_id: Optional[int] = None
    administered_at: datetime
    dose_given: str
    notes: Optional[str] = None


class AdministrationCreate(BaseModel):
    medication_assignment_id: int
    caregiver_id: Optional[int] = None
    dose_given: str
    notes: Optional[str] = None


class AdministrationUpdate(BaseModel):
    administered_at: Optional[datetime] = None
    dose_given: Optional[str] = None
    caregiver_id: Optional[int] = None
    notes: Optional[str] = None


class Administration(AdministrationBase):
    id: int
    caregiver_id: Optional[int] = None
    created_at: datetime
    assignment: Optional[MedicationAssignment] = None
    caregiver: Optional[Caregiver] = None

    class Config:
        from_attributes = True


# Inventory Schemas
class MedicationInventoryBase(BaseModel):
    medication_id: int
    quantity: float
    unit: str
    low_stock_threshold: Optional[float] = None


class MedicationInventoryCreate(MedicationInventoryBase):
    pass


class MedicationInventoryUpdate(BaseModel):
    quantity: Optional[float] = None
    unit: Optional[str] = None
    low_stock_threshold: Optional[float] = None


class MedicationInventory(MedicationInventoryBase):
    id: int
    last_updated: datetime
    medication: Medication

    class Config:
        from_attributes = True

