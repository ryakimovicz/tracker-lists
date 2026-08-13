from app.core.database import engine, Base
from app.models.translation import TranslationCache

print("Creating TranslationCache table...")
Base.metadata.create_all(bind=engine, tables=[TranslationCache.__table__])
print("Done.")
