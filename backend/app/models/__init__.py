from app.models.base import Base, UUIDMixin
from app.models.core import User, AdminProfile, PasswordResetToken, EmailVerificationToken, RefreshToken, UserRole
from app.models.settings import SiteSetting, SettingKey
from app.models.catalogs import Industry, Zone, ContractType, Skill, SkillCategory
from app.models.company import CompanyProfile, CompanyVerificationDocument, VerificationStatus
from app.models.candidate import CandidateProfile, Experience, Education, CandidateSkill, Language, EducationLevel, LanguageLevel
from app.models.job import JobPosting, JobPostingSkill, Application, JobPostingModality, JobPostingStatus, ApplicationStatus
from app.models.ai import AiUsageLog, CandidateAiIndex, CandidateChunk, CandidateCvText, JobAiProfile, JobRecommendation, JobRequirementVector, RecommendationRefresh
from app.models.prospect import Prospect, ProspectEmail, ProspectEvent, ProspectSync, ProspectStage
from app.models.payment import Plan, Subscription, JobFeature, Payment, MercadoPagoWebhookEvent, SubscriptionStatus, JobFeatureStatus, PaymentType, CvReviewOrder, CvReviewStatus
from app.models.tests import PsychometricTest, TestQuestion, TestQuestionOption, TestSubmission, TestAnswer, ScoringMethod, QuestionType, TestSubmissionStatus
from app.models.email import (
    EmailOutbox, EmailTemplate, EmailPreference, EmailSuppression, EmailCampaign, EmailDigestState,
    EmailCategory, EmailStatus, CampaignStatus,
)
from app.models.alerts import JobAlert, JobAlertNotification, AuditLog, Notification
from app.models.contact import ContactMessage, ContactTopic
from app.models.history import ApplicationNote, ApplicationStatusHistory, CandidateActivityLog
from app.models.landing import LandingStat

__all__ = [
    "EmailOutbox",
    "EmailTemplate",
    "EmailPreference",
    "EmailSuppression",
    "EmailCampaign",
    "EmailDigestState",
    "EmailCategory",
    "EmailStatus",
    "CampaignStatus",
    "Base",
    "UUIDMixin",
    "User",
    "AdminProfile",
    "PasswordResetToken",
    "EmailVerificationToken",
    "RefreshToken",
    "UserRole",
    "Industry",
    "Zone",
    "ContractType",
    "Skill",
    "SkillCategory",
    "SiteSetting",
    "SettingKey",
    "CompanyProfile",
    "CompanyVerificationDocument",
    "VerificationStatus",
    "CandidateProfile",
    "Experience",
    "Education",
    "CandidateSkill",
    "Language",
    "EducationLevel",
    "LanguageLevel",
    "JobPosting",
    "JobPostingSkill",
    "Application",
    "JobPostingModality",
    "JobPostingStatus",
    "ApplicationStatus",
    "Plan",
    "Subscription",
    "JobFeature",
    "Payment",
    "MercadoPagoWebhookEvent",
    "SubscriptionStatus",
    "JobFeatureStatus",
    "PaymentType",
    "CvReviewOrder",
    "CvReviewStatus",
    "AiUsageLog",
    "CandidateAiIndex",
    "CandidateChunk",
    "CandidateCvText",
    "JobAiProfile",
    "JobRecommendation",
    "JobRequirementVector",
    "RecommendationRefresh",
    "Prospect",
    "ProspectEmail",
    "ProspectEvent",
    "ProspectSync",
    "ProspectStage",
    "PsychometricTest",
    "TestQuestion",
    "TestQuestionOption",
    "TestSubmission",
    "TestAnswer",
    "ScoringMethod",
    "QuestionType",
    "TestSubmissionStatus",
    "JobAlert",
    "JobAlertNotification",
    "AuditLog",
    "Notification",
    "ContactMessage",
    "ContactTopic",
    "ApplicationNote",
    "ApplicationStatusHistory",
    "CandidateActivityLog",
    "LandingStat",
]
