# Import all models here so SQLAlchemy/Alembic knows about them
from app.core.database import Base
from app.models.user import User
from app.models.list import ReadingList, VisibilityEnum
from app.models.list_item import ListItem, ItemTypeEnum
from app.models.saved_list import SavedList
from app.models.item_progress import ItemProgress
from app.models.library import UserLibraryItem, UserLibraryStatusEnum
from app.models.social import ListVote, ListReport, Comment, CommentVote, CommentReport, Follow
from app.models.review import MediaReview, MediaReviewVote, MediaReviewReport
from app.models.addition import ListAddition, ListAdditionItem, UserAdoptedAddition, AdditionVote, AdditionComment

__all__ = [
    "Base",
    "User",
    "ReadingList",
    "VisibilityEnum",
    "ListItem",
    "ItemTypeEnum",
    "SavedList",
    "ItemProgress",
    "UserLibraryItem",
    "UserLibraryStatusEnum",
    "ListVote",
    "ListReport",
    "Comment",
    "CommentVote",
    "CommentReport",
    "Follow",
    "MediaReview",
    "MediaReviewVote",
    "MediaReviewReport",
    "ListAddition",
    "ListAdditionItem",
    "UserAdoptedAddition",
    "AdditionVote",
    "AdditionComment"
]
