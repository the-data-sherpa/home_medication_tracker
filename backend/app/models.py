"""SQLAlchemy database models."""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class FamilyMember(Base):
    """Family member model."""
    __tablename__ = "family_members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    active = Column(Boolean, default=True)

    assignments = relationship("MedicationAssignment", back_populates="family_member")


class Caregiver(Base):
    """Caregiver model - tracks who logs/administers medications."""
    __tablename__ = "caregivers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    active = Column(Boolean, default=True)

    administrations = relationship("Administration", back_populates="caregiver")


class Medication(Base):
    """Medication model."""
    __tablename__ = "medications"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    default_dose = Column(String, nullable=False)  # e.g., "2.5mL"
    default_frequency_hours = Column(Float, nullable=True)  # e.g., 4.0 for fixed frequency
    default_frequency_min_hours = Column(Float, nullable=True)  # e.g., 4.0 for range frequency
    default_frequency_max_hours = Column(Float, nullable=True)  # e.g., 6.0 for range frequency
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Note: Frequency validation is handled in Pydantic schemas
    # Database constraint: Either fixed OR range must be set (enforced by application logic)

    assignments = relationship("MedicationAssignment", back_populates="medication")
    inventory = relationship("MedicationInventory", back_populates="medication", uselist=False)


class MedicationAssignment(Base):
    """Medication assignment to family member."""
    __tablename__ = "medication_assignments"

    id = Column(Integer, primary_key=True, index=True)
    family_member_id = Column(Integer, ForeignKey("family_members.id"), nullable=False)
    medication_id = Column(Integer, ForeignKey("medications.id"), nullable=False)
    current_dose = Column(String, nullable=True)  # Can override default
    frequency_hours = Column(Float, nullable=True)  # Can override default for fixed frequency
    frequency_min_hours = Column(Float, nullable=True)  # Can override default min for range frequency
    frequency_max_hours = Column(Float, nullable=True)  # Can override default max for range frequency
    active = Column(Boolean, default=True)
    schedule_type = Column(String, nullable=True)  # null, "daily", "weekly"
    schedule_time = Column(String, nullable=True)  # e.g., "08:00"
    schedule_days = Column(String, nullable=True)  # e.g., "monday,wednesday,friday"
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    family_member = relationship("FamilyMember", back_populates="assignments")
    medication = relationship("Medication", back_populates="assignments")
    administrations = relationship("Administration", back_populates="assignment", order_by="desc(Administration.administered_at)")


class Administration(Base):
    """Medication administration record."""
    __tablename__ = "administrations"

    id = Column(Integer, primary_key=True, index=True)
    medication_assignment_id = Column(Integer, ForeignKey("medication_assignments.id"), nullable=False)
    caregiver_id = Column(Integer, ForeignKey("caregivers.id"), nullable=True)  # Who logged/administered
    administered_at = Column(DateTime(timezone=True), nullable=False, index=True)
    dose_given = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    assignment = relationship("MedicationAssignment", back_populates="administrations")
    caregiver = relationship("Caregiver", back_populates="administrations")


class MedicationInventory(Base):
    """Medication inventory tracking."""
    __tablename__ = "medication_inventory"

    id = Column(Integer, primary_key=True, index=True)
    medication_id = Column(Integer, ForeignKey("medications.id"), nullable=False, unique=True)
    quantity = Column(Float, nullable=False)
    unit = Column(String, nullable=False)  # e.g., "mL", "tablets", "capsules"
    low_stock_threshold = Column(Float, nullable=True)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    medication = relationship("Medication", back_populates="inventory")

