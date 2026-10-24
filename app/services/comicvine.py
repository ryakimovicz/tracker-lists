"""
Backward compatibility module: Metron (https://metron.cloud) replaces Comic Vine.
All calls to ComicVineService are seamlessly forwarded to MetronService.
"""
from app.services.metron import MetronService, ComicVineService

__all__ = ["ComicVineService", "MetronService"]
