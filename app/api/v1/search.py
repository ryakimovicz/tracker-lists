from typing import List
from fastapi import APIRouter, Query, HTTPException, status, Request
from app.services.base import SearchResultItem
from app.services.mangadex import MangaDexService
from app.services.comicvine import ComicVineService
from app.services.tmdb import TMDBService
from app.services.googlebooks import GoogleBooksService
from app.services.rawg import RAWGService
from app.services.anilist import AniListService
from app.core.limiter import limiter

router = APIRouter()

@router.get("/", response_model=List[SearchResultItem])
@limiter.limit("20/minute")
def search_media(
    request: Request,
    q: str = Query(..., min_length=1, description="The search query term"),
    type: str = Query(..., description="The media type: 'comic', 'manga', 'book', 'game', 'movie' or 'series'")
):
    type_lower = type.lower()
    if type_lower == "manga":
        return MangaDexService.search_manga(q)
    elif type_lower == "comic":
        return ComicVineService.search_comics(q)
    elif type_lower == "book":
        return GoogleBooksService.search_books(q)
    elif type_lower == "game":
        return RAWGService.search_games(q)
    elif type_lower == "movie":
        return TMDBService.search_media(q, "movie")
    elif type_lower == "series":
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            future_tmdb = executor.submit(TMDBService.search_media, q, "series")
            future_anilist = executor.submit(AniListService.search_anime, q)
            tmdb_res = future_tmdb.result()
            anilist_res = future_anilist.result()
        
        if anilist_res is None:
            combined = tmdb_res
        else:
            filtered_tmdb = [item for item in tmdb_res if item.item_type != "anime"]
            combined = filtered_tmdb + anilist_res
        
        query_clean = q.lower().strip()
        query_words = set(query_clean.split())
        def calculate_score(item: SearchResultItem):
            title_clean = item.title.lower().strip()
            score = 0.0
            if title_clean == query_clean:
                score += 100.0
            elif title_clean.startswith(query_clean):
                score += 50.0
            elif query_clean in title_clean:
                score += 30.0
            title_words = set(title_clean.split())
            common_words = query_words.intersection(title_words)
            score += len(common_words) * 15.0
            
            # Density boost: Shorter titles matching the query density get prioritized
            if len(item.title) > 0:
                score += (1.0 / len(item.title)) * 10.0
                
            # Popularity boost (capped at 100 to prevent overtaking text similarity but breaking ties)
            score += min(item.popularity or 0.0, 100.0)
            return score
        combined.sort(key=calculate_score, reverse=True)
        return combined
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid search type. Must be 'comic', 'manga', 'book', 'game', 'movie' or 'series'."
        )

@router.get("/all", response_model=List[SearchResultItem])
@limiter.limit("20/minute")
def search_all_media(
    request: Request,
    q: str = Query(..., min_length=1, description="The search query term")
):
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as executor:
        future_movies = executor.submit(TMDBService.search_media, q, "movie")
        future_series = executor.submit(TMDBService.search_media, q, "series")
        future_animes = executor.submit(AniListService.search_anime, q)
        future_books = executor.submit(GoogleBooksService.search_books, q)
        future_games = executor.submit(RAWGService.search_games, q)
        future_mangas = executor.submit(MangaDexService.search_manga, q)
        future_comics = executor.submit(ComicVineService.search_comics, q)
        
        movies = future_movies.result()
        series = future_series.result()
        animes = future_animes.result()
        books = future_books.result()
        games = future_games.result()
        mangas = future_mangas.result()
        comics = future_comics.result()
        
    combined = []
    combined.extend(movies)
    if animes is None:
        combined.extend(series)
    else:
        filtered_series = [item for item in series if item.item_type != "anime"]
        combined.extend(filtered_series)
        combined.extend(animes)
    combined.extend(books)
    combined.extend(games)
    combined.extend(mangas)
    combined.extend(comics)

    query_clean = q.lower().strip()
    query_words = set(query_clean.split())

    def calculate_score(item: SearchResultItem):
        title_clean = item.title.lower().strip()
        score = 0.0
        if title_clean == query_clean:
            score += 100.0
        elif title_clean.startswith(query_clean):
            score += 50.0
        elif query_clean in title_clean:
            score += 30.0
        title_words = set(title_clean.split())
        common_words = query_words.intersection(title_words)
        score += len(common_words) * 15.0
        
        # Density boost: Shorter titles matching the query density get prioritized
        if len(item.title) > 0:
            score += (1.0 / len(item.title)) * 10.0
            
        # Popularity boost (capped at 100 to prevent overtaking text similarity but breaking ties)
        score += min(item.popularity or 0.0, 100.0)
        return score

    combined.sort(key=calculate_score, reverse=True)
    return combined

@router.get("/series/{series_id}/season/{season_number}")
def get_series_season_episodes(
    series_id: int,
    season_number: int
):
    try:
        return TMDBService.get_season_episodes(series_id, season_number)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch season episodes: {str(e)}"
        )

@router.get("/series/{series_id}")
def get_series_detail(
    series_id: int
):
    try:
        return TMDBService.get_series_detail(series_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to fetch series detail: {str(e)}"
        )
