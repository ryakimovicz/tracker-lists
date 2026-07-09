from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.list import ReadingList, VisibilityEnum
from app.models.list_item import ListItem
from app.models.addition import ListAddition, ListAdditionItem, UserAdoptedAddition, AdditionVote, AdditionComment
from app.models.item_progress import ItemProgress
from app.schemas.addition import (
    ListAdditionCreate,
    ListAdditionResponse,
    ListAdditionItemCreate,
    ListAdditionItemResponse,
    AdditionCommentCreate,
    AdditionCommentResponse
)

router = APIRouter()

# --- 1. Manage Additions & Items ---

@router.post("/lists/{list_id}/additions", response_model=ListAdditionResponse, status_code=status.HTTP_201_CREATED)
def create_list_addition(
    list_id: int,
    addition_in: ListAdditionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    reading_list = db.query(ReadingList).filter(ReadingList.id == list_id).first()
    if not reading_list:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reading list not found")
        
    if reading_list.visibility == VisibilityEnum.PRIVATE and reading_list.creator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot add extensions to a private list you do not own"
        )
        
    addition = ListAddition(
        list_id=list_id,
        user_id=current_user.id,
        title=addition_in.title,
        description=addition_in.description,
        is_shared=addition_in.is_shared,
        created_at=datetime.now(timezone.utc)
    )
    db.add(addition)
    db.commit()
    db.refresh(addition)
    
    return ListAdditionResponse(
        id=addition.id,
        list_id=addition.list_id,
        user_id=addition.user_id,
        username=current_user.username,
        title=addition.title,
        description=addition.description,
        is_shared=addition.is_shared,
        created_at=addition.created_at,
        items=[]
    )

@router.post("/additions/{addition_id}/items", response_model=ListAdditionItemResponse, status_code=status.HTTP_201_CREATED)
def add_item_to_addition(
    addition_id: int,
    item_in: ListAdditionItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    addition = db.query(ListAddition).filter(
        ListAddition.id == addition_id,
        ListAddition.user_id == current_user.id
    ).first()
    if not addition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Addition not found or access denied")
        
    # Verify the anchor item exists in the list
    if item_in.after_item_id:
        anchor = db.query(ListItem).filter(
            ListItem.id == item_in.after_item_id,
            ListItem.list_id == addition.list_id
        ).first()
        if not anchor:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Anchor item (after_item_id) does not exist in this reading list"
            )
            
    addition_item = ListAdditionItem(
        addition_id=addition_id,
        after_item_id=item_in.after_item_id,
        order_index=item_in.order_index,
        item_type=item_in.item_type,
        external_id=item_in.external_id,
        title=item_in.title,
        image_url=item_in.image_url,
        custom_notes=item_in.custom_notes,
        section=item_in.section,
        importance_rank=item_in.importance_rank
    )
    db.add(addition_item)
    db.commit()
    db.refresh(addition_item)
    
    return addition_item

# --- 2. Explore & Adopt Community Additions ---

@router.get("/lists/{list_id}/additions/community", response_model=List[ListAdditionResponse])
def get_community_additions(
    list_id: int,
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch all shared additions for this list, excluding ones created by the current user
    additions = db.query(ListAddition).filter(
        ListAddition.list_id == list_id,
        ListAddition.is_shared == True,
        ListAddition.user_id != current_user.id
    ).offset(skip).limit(limit).all()
    
    results = []
    for add in additions:
        votes_count = db.query(AdditionVote).filter(AdditionVote.addition_id == add.id).count()
        is_voted = db.query(AdditionVote).filter(
            AdditionVote.addition_id == add.id,
            AdditionVote.user_id == current_user.id
        ).first() is not None
        
        results.append(
            ListAdditionResponse(
                id=add.id,
                list_id=add.list_id,
                user_id=add.user_id,
                username=add.user.username if add.user else "Unknown",
                title=add.title,
                description=add.description,
                is_shared=add.is_shared,
                created_at=add.created_at,
                vote_count=votes_count,
                is_voted_by_me=is_voted,
                items=add.items
            )
        )
        
    # Sort by vote count descending
    results.sort(key=lambda x: x.vote_count, reverse=True)
    return results

@router.post("/additions/{addition_id}/adopt")
def adopt_addition(
    addition_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    addition = db.query(ListAddition).filter(
        ListAddition.id == addition_id,
        ListAddition.is_shared == True
    ).first()
    if not addition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared addition not found")
        
    if addition.user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot adopt your own addition (it is already active)")
        
    existing = db.query(UserAdoptedAddition).filter(
        UserAdoptedAddition.user_id == current_user.id,
        UserAdoptedAddition.addition_id == addition_id
    ).first()
    
    if existing:
        return {"message": "You have already adopted this addition"}
        
    adoption = UserAdoptedAddition(user_id=current_user.id, addition_id=addition_id)
    db.add(adoption)
    db.commit()
    
    return {"message": "Addition adopted successfully"}

@router.delete("/additions/{addition_id}/adopt", status_code=status.HTTP_204_NO_CONTENT)
def remove_adopted_addition(
    addition_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    adoption = db.query(UserAdoptedAddition).filter(
        UserAdoptedAddition.user_id == current_user.id,
        UserAdoptedAddition.addition_id == addition_id
    ).first()
    if not adoption:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Adopted relationship not found")
        
    db.delete(adoption)
    db.commit()
    return None

# --- 3. Votes & Comments on Shared Additions ---

@router.post("/additions/{addition_id}/vote")
def toggle_addition_vote(
    addition_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    addition = db.query(ListAddition).filter(
        ListAddition.id == addition_id,
        ListAddition.is_shared == True
    ).first()
    if not addition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared addition not found")
        
    vote = db.query(AdditionVote).filter(
        AdditionVote.user_id == current_user.id,
        AdditionVote.addition_id == addition_id
    ).first()
    
    if vote:
        db.delete(vote)
        db.commit()
        return {"message": "Vote removed", "is_voted": False}
    else:
        vote = AdditionVote(user_id=current_user.id, addition_id=addition_id)
        db.add(vote)
        db.commit()
        return {"message": "Vote registered", "is_voted": True}

@router.post("/additions/{addition_id}/comments", response_model=AdditionCommentResponse, status_code=status.HTTP_201_CREATED)
def comment_on_addition(
    addition_id: int,
    comment_in: AdditionCommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    addition = db.query(ListAddition).filter(
        ListAddition.id == addition_id,
        ListAddition.is_shared == True
    ).first()
    if not addition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shared addition not found")
        
    comment = AdditionComment(
        user_id=current_user.id,
        addition_id=addition_id,
        content=comment_in.content,
        created_at=datetime.now(timezone.utc)
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    
    return AdditionCommentResponse(
        id=comment.id,
        user_id=comment.user_id,
        username=current_user.username,
        addition_id=comment.addition_id,
        content=comment.content,
        created_at=comment.created_at
    )

@router.get("/additions/{addition_id}/comments", response_model=List[AdditionCommentResponse])
def get_addition_comments(
    addition_id: int,
    db: Session = Depends(get_db)
):
    comments = db.query(AdditionComment).filter(AdditionComment.addition_id == addition_id).all()
    
    response = []
    for c in comments:
        response.append(
            AdditionCommentResponse(
                id=c.id,
                user_id=c.user_id,
                username=c.user.username if c.user else "Unknown",
                addition_id=c.addition_id,
                content=c.content,
                created_at=c.created_at
            )
        )
    return response

# --- 4. Progress Tracking on Addition Items ---

@router.post("/items/additions/{addition_item_id}/toggle")
def toggle_addition_item_progress(
    addition_item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(ListAdditionItem).filter(ListAdditionItem.id == addition_item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Addition item not found")
        
    # Verify accessibility (shared addition, owned, or adopted)
    addition = item.addition
    is_owner = addition.user_id == current_user.id
    is_adopted = db.query(UserAdoptedAddition).filter(
        UserAdoptedAddition.user_id == current_user.id,
        UserAdoptedAddition.addition_id == addition.id
    ).first() is not None
    
    if not is_owner and not is_adopted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must own or adopt this addition to check its item progress"
        )
        
    if item.external_id:
        progress = db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            ItemProgress.item_type == item.item_type,
            ItemProgress.external_id == item.external_id
        ).first()
    else:
        progress = db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            ItemProgress.addition_item_id == addition_item_id
        ).first()
    
    if progress:
        progress.is_completed = not progress.is_completed
        if progress.is_completed:
            progress.is_skipped = False
        progress.completed_at = datetime.now(timezone.utc) if progress.is_completed else None
    else:
        if item.external_id:
            progress = ItemProgress(
                user_id=current_user.id,
                item_type=item.item_type,
                external_id=item.external_id,
                addition_item_id=addition_item_id,
                is_completed=True,
                is_skipped=False,
                completed_at=datetime.now(timezone.utc)
            )
        else:
            progress = ItemProgress(
                user_id=current_user.id,
                addition_item_id=addition_item_id,
                is_completed=True,
                is_skipped=False,
                completed_at=datetime.now(timezone.utc)
            )
        db.add(progress)
        
    db.commit()
    return {
        "addition_item_id": addition_item_id,
        "is_completed": progress.is_completed,
        "is_skipped": progress.is_skipped
    }

@router.post("/items/additions/{addition_item_id}/toggle-skip")
def toggle_addition_item_skip(
    addition_item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(ListAdditionItem).filter(ListAdditionItem.id == addition_item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Addition item not found")
        
    addition = item.addition
    is_owner = addition.user_id == current_user.id
    is_adopted = db.query(UserAdoptedAddition).filter(
        UserAdoptedAddition.user_id == current_user.id,
        UserAdoptedAddition.addition_id == addition.id
    ).first() is not None
    
    if not is_owner and not is_adopted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must own or adopt this addition to check its item progress"
        )
        
    if item.external_id:
        progress = db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            ItemProgress.item_type == item.item_type,
            ItemProgress.external_id == item.external_id
        ).first()
    else:
        progress = db.query(ItemProgress).filter(
            ItemProgress.user_id == current_user.id,
            ItemProgress.addition_item_id == addition_item_id
        ).first()
    
    if progress:
        progress.is_skipped = not progress.is_skipped
        if progress.is_skipped:
            progress.is_completed = False
        progress.completed_at = datetime.now(timezone.utc) if progress.is_skipped else None
    else:
        if item.external_id:
            progress = ItemProgress(
                user_id=current_user.id,
                item_type=item.item_type,
                external_id=item.external_id,
                addition_item_id=addition_item_id,
                is_completed=False,
                is_skipped=True,
                completed_at=datetime.now(timezone.utc)
            )
        else:
            progress = ItemProgress(
                user_id=current_user.id,
                addition_item_id=addition_item_id,
                is_completed=False,
                is_skipped=True,
                completed_at=datetime.now(timezone.utc)
            )
        db.add(progress)
        
    db.commit()
    return {
        "addition_item_id": addition_item_id,
        "is_completed": progress.is_completed,
        "is_skipped": progress.is_skipped
    }
