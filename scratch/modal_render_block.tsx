        const isEpisode = !!(selectedItem.external_id?.startsWith('tmdb-ep-') || selectedItem.list_id);
        const ratings = itemReviews.filter(r => r.rating !== null && r.rating !== 0).map(r => r.rating);
        const avgRating = ratings.length > 0 ? (ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1) : null;
        return (
          <div
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000
            }}
          >
            <div
              className="glass-card"
              style={{
                width: '650px',
                maxHeight: '90vh',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                overflowY: 'auto',
                textAlign: 'left'
              }}
            >
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  {isEpisode && (
                    <button
                      onClick={async () => {
                        const mainSeriesItem = libraryItems.find(li => li.tracking_list_id === selectedItem.list_id);
                        if (mainSeriesItem) {
                          handleOpenItemDetails(mainSeriesItem);
                        } else {
                          // Try searching by name if no tracking_list_id matches directly
                          setSelectedItem(null);
                        }
                      }}
                      className="btn-secondary"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.78rem', display: 'flex', alignItems: 'center' }}
                    >
                      &larr; {language === 'es' ? 'Volver' : 'Back'}
                    </button>
                  )}
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{selectedItem.title}</h2>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', textTransform: 'uppercase', fontWeight: 700 }}>
                        {t('media' + selectedItem.item_type.charAt(0).toUpperCase() + selectedItem.item_type.slice(1))}
                      </span>
                      {avgRating && (
                        <span style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.1rem' }}>
                          ★ {avgRating} / 5 ({ratings.length} {language === 'es' ? 'val.' : 'ratings'})
                        </span>
                      )}
                      {selectedItem.completed_at && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          • {selectedItem.item_type === 'movie' || selectedItem.item_type === 'series'
                            ? (language === 'es' ? 'Visto el: ' : 'Watched on: ')
                            : (language === 'es' ? 'Terminado el: ' : 'Completed on: ')
                          }
                          {formatDate(new Date(selectedItem.completed_at))}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.2rem' }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body Info */}
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                {selectedItem.image_url && (
                  <img
                    src={selectedItem.image_url}
                    alt={selectedItem.title}
                    onClick={() => setZoomedImage(selectedItem.image_url)}
                    style={{ width: '130px', height: '190px', objectFit: 'cover', borderRadius: '8px', cursor: 'zoom-in', boxShadow: '0 5px 15px rgba(0,0,0,0.3)' }}
                  />
                )}
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: '250px' }}>
                  {/* Description info */}
                  {(() => {
                    const parseNotes = (notes: string) => {
                      try {
                        if (notes.startsWith('{')) return JSON.parse(notes);
                      } catch(e){}
                      return { description: notes, sub_items: [] };
                    };
                    const stripHtml = (html: string) => {
                      if (!html) return '';
                      const clean = html.replace(/<[^>]*>/g, '');
                      const txt = document.createElement('textarea');
                      txt.innerHTML = clean;
                      return txt.value;
                    };

                    if (isLoadingMetadata) {
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.25rem 0' }}>
                          <div>
                            <h5 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Descripción:' : 'Description:'}</h5>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                              <div className="skeleton" style={{ height: '0.85rem', width: '100%' }}></div>
                              <div className="skeleton" style={{ height: '0.85rem', width: '92%' }}></div>
                              <div className="skeleton" style={{ height: '0.85rem', width: '95%' }}></div>
                              <div className="skeleton" style={{ height: '0.85rem', width: '45%' }}></div>
                            </div>
                          </div>
                          <div>
                            <h5 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Fecha de lanzamiento:' : 'Release Date:'}</h5>
                            <div className="skeleton" style={{ height: '0.9rem', width: '130px' }}></div>
                          </div>
                        </div>
                      );
                    }

                    const notes = parseNotes(selectedItem.custom_notes || '');
                    if (!notes.description) return null;
                    const cleanText = stripHtml(notes.description);
                    const shouldTruncate = cleanText.length > 180;
                    const displayedText = shouldTruncate && !descExpanded
                      ? cleanText.slice(0, 180) + '...'
                      : cleanText;

                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                          <h5 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Descripción:' : 'Description:'}</h5>
                          <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                            {displayedText}
                            {shouldTruncate && (
                              <button
                                onClick={() => setDescExpanded(!descExpanded)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--accent-primary)',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  fontSize: '0.82rem',
                                  marginLeft: '0.4rem',
                                  padding: 0
                                }}
                              >
                                {descExpanded
                                  ? (language === 'es' ? 'Leer menos' : 'Read less')
                                  : (language === 'es' ? 'Leer más' : 'Read more')
                                }
                              </button>
                            )}
                          </p>
                        </div>
                        {(selectedItem.release_date || notes.release_date) && (
                          <div>
                            <h5 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-secondary)' }}>
                              {language === 'es' ? 'Fecha de lanzamiento:' : 'Release Date:'}
                            </h5>
                            <span style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                              {formatReleaseDate(selectedItem.release_date || notes.release_date)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Star rating selector */}
                  <div>
                    <h5 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Tu Calificación:' : 'Your Rating:'}</h5>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          disabled={!isOwnProfile}
                          onClick={() => handleSaveRating(star)}
                          style={{ background: 'transparent', border: 'none', cursor: isOwnProfile ? 'pointer' : 'default', padding: 0 }}
                        >
                          <Star
                            size={24}
                            fill={star <= userRating ? '#f59e0b' : 'none'}
                            color={star <= userRating ? '#f59e0b' : 'var(--text-muted)'}
                          />
                        </button>
                      ))}
                      {isOwnProfile && userRating > 0 && (
                        <button
                          onClick={handleDeleteRating}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            fontSize: '0.78rem',
                            cursor: 'pointer',
                            marginLeft: '0.75rem',
                            padding: 0,
                            textDecoration: 'underline'
                          }}
                        >
                          {language === 'es' ? 'Eliminar puntuación' : 'Clear rating'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Favorite toggler */}
                  {isOwnProfile && !isEpisode && (
                    <div>
                      <button
                        onClick={() => handleToggleFavorite(selectedItem.id, isFavorite)}
                        className="btn-secondary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.85rem',
                          padding: '0.4rem 0.8rem',
                          borderColor: isFavorite ? 'var(--accent-primary)' : 'var(--border-color)',
                          background: isFavorite ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
                          color: isFavorite ? 'var(--accent-primary)' : 'var(--text-primary)'
                        }}
                      >
                        <Heart size={16} fill={isFavorite ? 'var(--accent-primary)' : 'none'} />
                        {isFavorite
                          ? (language === 'es' ? 'Destacado (Quitar)' : 'Featured (Remove)')
                          : (language === 'es' ? 'Destacar (Favorito)' : 'Feature (Favorite)')
                        }
                      </button>
                    </div>
                  )}

                  {/* Status selection inside modal */}
                  {!isEpisode && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                      <h5 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {language === 'es' ? 'Estado:' : 'Status:'}
                      </h5>
                      <select
                        className="input-field"
                        disabled={!isOwnProfile}
                        value={selectedItem.status || ''}
                        onChange={async (e) => {
                          const newStatus = e.target.value;
                          await handleStatusChange(selectedItem.id, newStatus);
                          setSelectedItem((prev: any) => prev ? { ...prev, status: newStatus } : null);
                          if (selectedItem.item_type === 'series' && newStatus === 'completed' && selectedItem.tracking_list_id) {
                            const listRes = await apiClient.get(`/lists/${selectedItem.tracking_list_id}`);
                            setEpisodes(listRes.data.items || []);
                          }
                        }}
                        style={{
                          padding: '0.4rem 0.8rem',
                          fontSize: '0.85rem',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          borderRadius: '6px',
                          maxWidth: '200px'
                        }}
                      >
                        {getAllowedStatuses(selectedItem.item_type).map(status => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Pages read input for books/comics/mangas */}
                  {!isEpisode && selectedItem && ['book', 'comic', 'manga'].includes(selectedItem.item_type) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                      <h5 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        {language === 'es' ? 'Páginas leídas:' : 'Pages read:'}
                      </h5>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="number"
                          className="input-field"
                          disabled={!isOwnProfile}
                          value={pagesReadVal}
                          min={0}
                          onFocus={() => {
                            if (pagesReadVal === 0) setPagesReadVal('');
                          }}
                          onBlur={() => {
                            const finalVal = pagesReadVal === '' ? 0 : pagesReadVal;
                            setPagesReadVal(finalVal);
                            handleSavePagesRead(finalVal);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const finalVal = pagesReadVal === '' ? 0 : pagesReadVal;
                              setPagesReadVal(finalVal);
                              handleSavePagesRead(finalVal);
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : parseInt(e.target.value) || 0;
                            setPagesReadVal(val);
                          }}
                          style={{
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.85rem',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            borderRadius: '6px',
                            maxWidth: '120px'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Episode seen checkbox and date completed */}
                  {isEpisode && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          disabled={!isOwnProfile}
                          checked={!!selectedItem.completed_at}
                          onChange={async () => {
                            await handleToggleEpisode(selectedItem.list_id, {
                              id: selectedItem.rawEpisodeId,
                              title: selectedItem.title,
                              image_url: selectedItem.image_url,
                              custom_notes: selectedItem.custom_notes,
                              season_number: selectedItem.season_number,
                              episode_number: selectedItem.episode_number
                            });
                          }}
                          style={{ width: '18px', height: '18px', cursor: isOwnProfile ? 'pointer' : 'default' }}
                        />
                        {language === 'es' ? 'Marcar como visto' : 'Mark as seen'}
                      </label>
                      {selectedItem.completed_at && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          {language === 'es' ? 'Visto el: ' : 'Watched on: '}
                          {formatDate(new Date(selectedItem.completed_at))}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* TV Series Season Accordion Tracking */}
              {selectedItem.item_type === 'series' && seasons.length > 0 && !isEpisode && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem' }}>
                    {language === 'es' ? 'Seguimiento de Temporadas' : 'Season Tracking'}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {seasons.map((s) => {
                      const isSeasonActive = activeSeason === s.season_number;
                      return (
                        <div key={s.id || s.season_number} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (isSeasonActive) {
                                setActiveSeason(null);
                              } else {
                                setActiveSeason(s.season_number);
                                handleLoadSeasonEpisodes(selectedItem.external_id, s.season_number);
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '0.75rem 1rem',
                              background: 'var(--bg-secondary)',
                              border: 'none',
                              color: 'var(--text-primary)',
                              fontWeight: 600,
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <span>
                              <input
                                type="checkbox"
                                disabled={!isOwnProfile}
                                checked={(() => {
                                  const listSeps = episodes.filter(x => x.section === `Season ${s.season_number}`);
                                  const cacheKey = `${selectedItem.external_id}_s${s.season_number}`;
                                  const tmdbEps = getCachedTMDB(cacheKey) || [];
                                  if (tmdbEps.length === 0) {
                                    return listSeps.length > 0 && listSeps.every(x => x.is_completed);
                                  }
                                  return tmdbEps.every((te: any) => episodes.some(x => x.external_id === `tmdb-ep-${te.id}` && x.is_completed));
                                })()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                                onChange={async (e) => {
                                  e.stopPropagation();
                                  const checkedVal = e.target.checked;
                                  const cacheKey = `${selectedItem.external_id}_s${s.season_number}`;
                                  const tmdbEps = getCachedTMDB(cacheKey);
                                  
                                  try {
                                    await apiClient.post(`/lists/${selectedItem.tracking_list_id}/bulk-toggle-season`, {
                                      season_number: s.season_number,
                                      episodes: tmdbEps || null,
                                      completed: checkedVal
                                    });
                                    
                                    const listRes = await apiClient.get(`/lists/${selectedItem.tracking_list_id}`);
                                    setEpisodes(listRes.data.items || []);
                                    
                                    const libraryRes = await apiClient.get('/library/');
                                    setLibraryItems(libraryRes.data);
                                    
                                    const actRes = await apiClient.get('/users/me/activity');
                                    setActivities(actRes.data);
                                  } catch (err) {
                                    console.error("Bulk toggle failed", err);
                                  }
                                }}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', marginRight: '0.6rem', verticalAlign: 'middle' }}
                              />
                              {language === 'es' ? `Temporada ${s.season_number}` : `Season ${s.season_number}`}
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '0.5rem', fontWeight: 400 }}>
                                ({s.episode_count} {language === 'es' ? 'capítulos' : 'episodes'})
                              </span>
                            </span>
                            <span>{isSeasonActive ? '▼' : '►'}</span>
                          </button>

                          {isSeasonActive && (
                            <div style={{ padding: '0.5rem', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
                              {isLoadingSeasonEpisodes ? (
                                <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                  {language === 'es' ? 'Cargando capítulos...' : 'Loading episodes...'}
                                </div>
                              ) : (seasonEpisodes[s.season_number] || []).length === 0 ? (
                                <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                  {language === 'es' ? 'No se encontraron capítulos.' : 'No episodes found.'}
                                </div>
                              ) : (
                                (seasonEpisodes[s.season_number] || []).map((ep: any) => {
                                  const dbEp = episodes.find(x => x.external_id === `tmdb-ep-${ep.id}`);
                                  const isCompleted = !!dbEp?.is_completed;
                                  return (
                                    <div
                                      key={ep.id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.4rem 0.6rem',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '4px',
                                        gap: '1rem'
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                        <input
                                          type="checkbox"
                                          disabled={!isOwnProfile}
                                          checked={isCompleted}
                                          onChange={() => handleToggleEpisode(selectedItem.tracking_list_id, ep)}
                                          style={{ width: '18px', height: '18px', cursor: isOwnProfile ? 'pointer' : 'default' }}
                                        />
                                        <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                                          {ep.episode_number}. {ep.name || 'Untitled'}
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => handleOpenItemDetails({
                                          id: dbEp ? dbEp.id : ep.id,
                                          list_id: selectedItem.tracking_list_id,
                                          item_type: 'series',
                                          external_id: `tmdb-ep-${ep.id}`,
                                          title: `${selectedItem.title} - S${ep.season_number < 10 ? '0' + ep.season_number : ep.season_number}E${ep.episode_number < 10 ? '0' + ep.episode_number : ep.episode_number} - ${ep.name || 'Untitled'}`,
                                          image_url: ep.still_path ? `https://image.tmdb.org/t/p/w185${ep.still_path}` : selectedItem.image_url,
                                          custom_notes: ep.overview,
                                          completed_at: dbEp?.completed_at,
                                          season_number: ep.season_number,
                                          episode_number: ep.episode_number,
                                          rawEpisodeId: ep.id,
                                          release_date: ep.air_date
                                        })}
                                        className="btn-secondary"
                                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.74rem' }}
                                      >
                                        {language === 'es' ? 'Ver Info' : 'View Info'}
                                      </button>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Comment write area */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{language === 'es' ? 'Escribe tu reseña o comentario' : 'Write your review or comment'}</h4>
                <textarea
                  className="input-field"
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  placeholder={language === 'es' ? '¿Qué te pareció este elemento? Escribe aquí...' : 'What did you think of this item? Write here...'}
                  style={{ width: '100%', minHeight: '80px', padding: '0.75rem', background: 'var(--bg-secondary)', resize: 'vertical' }}
                />
                <button
                  onClick={handleSaveReview}
                  className="btn-primary"
                  disabled={isSavingReview}
                  style={{ alignSelf: 'flex-end', padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                >
                  {isSavingReview
                    ? (language === 'es' ? 'Guardando...' : 'Saving...')
                    : (language === 'es' ? 'Guardar Valoración' : 'Save Review')
                  }
                </button>
              </div>

              {/* Community Reviews List */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{language === 'es' ? 'Comentarios de la Comunidad' : 'Community Comments'}</h4>
                {itemReviews.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {language === 'es' ? 'Nadie ha comentado sobre esto aún.' : 'No comments on this item yet.'}
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '180px', overflowY: 'auto' }}>
                    {itemReviews.map((rev: any) => (
                      <div key={rev.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'capitalize' }}>{rev.username}</span>
                          {rev.rating && (
                            <div style={{ display: 'flex', gap: '0.1rem' }}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  size={12}
                                  fill={star <= rev.rating ? '#f59e0b' : 'none'}
                                  color={star <= rev.rating ? '#f59e0b' : 'var(--text-muted)'}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        {rev.content && (
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                            {rev.content}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
