import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import {
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Star,
  Heart,
  X
} from 'lucide-react';

export const ViewGuide: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  const [guide, setGuide] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  // Standalone details modal states
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [itemReviews, setItemReviews] = useState<any[]>([]);
  const [userRating, setUserRating] = useState<number>(0);
  const [userComment, setUserComment] = useState<string>('');
  const [isSavingReview, setIsSavingReview] = useState(false);

  // Fetch guide details and profile information on mount
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setErrorMsg('');
    
    // Fetch guide
    apiClient.get(`/lists/${id}`)
      .then(response => {
        setGuide(response.data);
        // Load persistent collapse states from localStorage
        const cachedCollapse = localStorage.getItem(`guide_collapsed_${id}`);
        if (cachedCollapse) {
          try {
            setCollapsedNodes(JSON.parse(cachedCollapse));
          } catch(e) {
            setCollapsedNodes({});
          }
        } else {
          setCollapsedNodes({});
        }
      })
      .catch(() => {
        setErrorMsg(language === 'es' ? 'Error al cargar los detalles de la guía.' : 'Error loading guide details.');
      })
      .finally(() => {
        setLoading(false);
      });

    // Fetch user profile
    apiClient.get('/users/me')
      .then(res => setCurrentUser(res.data))
      .catch(e => console.error(e));

    // Fetch shelf library items
    apiClient.get('/library/')
      .then(res => setLibraryItems(res.data))
      .catch(e => console.error(e));
  }, [id, language]);

  const toggleNodeCollapse = (nodeId: string) => {
    if (!guide) return;
    setCollapsedNodes(prev => {
      const updated = { ...prev, [nodeId]: !prev[nodeId] };
      localStorage.setItem(`guide_collapsed_${guide.id}`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleToggleItemProgress = async (itemId: number) => {
    if (!guide) return;
    try {
      await apiClient.post(`/lists/items/${itemId}/toggle`);
      
      // Update completion status in local viewing state
      setGuide((prev: any) => {
        if (!prev) return null;
        let toggledState = false;
        const updatedItems = (prev.items || []).map((item: any) => {
          if (item.id === itemId) {
            toggledState = !item.is_completed;
            return { ...item, is_completed: toggledState };
          }
          return item;
        });

        const completedCount = updatedItems.filter((i: any) => i.is_completed).length;
        const totalCount = updatedItems.length;
        const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

        return {
          ...prev,
          items: updatedItems,
          completed_count: completedCount,
          progress_percentage: Math.round(progressPercentage * 100) / 100
        };
      });

      // Refresh local library shelf since checking an item adds it to the shelf
      apiClient.get('/library/')
        .then(res => setLibraryItems(res.data))
        .catch(e => console.error(e));

    } catch (err: any) {
      setErrorMsg(language === 'es' ? 'Error al actualizar el progreso.' : 'Failed to toggle item progress.');
    }
  };

  const handleBulkToggle = async (itemIds: number[], completed: boolean) => {
    if (!guide || itemIds.length === 0) return;
    try {
      await apiClient.post(`/lists/${guide.id}/items/bulk-toggle`, {
        item_ids: itemIds,
        completed
      });

      setGuide((prev: any) => {
        if (!prev) return null;
        const updatedItems = (prev.items || []).map((item: any) => {
          if (itemIds.includes(item.id)) {
            return { ...item, is_completed: completed };
          }
          return item;
        });

        const completedCount = updatedItems.filter((i: any) => i.is_completed).length;
        const totalCount = updatedItems.length;
        const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

        return {
          ...prev,
          items: updatedItems,
          completed_count: completedCount,
          progress_percentage: Math.round(progressPercentage * 100) / 100
        };
      });

      // Refresh local library shelf
      apiClient.get('/library/')
        .then(res => setLibraryItems(res.data))
        .catch(e => console.error(e));

    } catch (err: any) {
      setErrorMsg(language === 'es' ? 'Error al actualizar el progreso.' : 'Failed to update bulk progress.');
    }
  };

  // Open overlay detail dialog
  const handleOpenItemDetails = async (item: any) => {
    setSelectedItem(item);
    setUserRating(0);
    setUserComment('');
    setItemReviews([]);

    try {
      const res = await apiClient.get(`/reviews/${item.item_type}/${item.external_id}`);
      setItemReviews(res.data);
      
      // Look if current user already has a review
      if (currentUser) {
        const myReview = res.data.find((r: any) => r.user_id === currentUser.id);
        if (myReview) {
          setUserRating(myReview.rating || 0);
          setUserComment(myReview.content || '');
        }
      }
    } catch(e) {
      console.error(e);
    }
  };

  const handleToggleFavorite = async () => {
    if (!selectedItem) return;
    try {
      const existing = libraryItems.find(li => li.item_type === selectedItem.item_type && li.external_id === selectedItem.external_id);
      const isFav = existing && ['completed', 'read'].includes(existing.status);

      let targetStatus: string;
      if (['book', 'comic', 'manga'].includes(selectedItem.item_type)) {
        targetStatus = isFav ? 'reading' : 'read';
      } else {
        targetStatus = isFav ? 'watching' : 'completed';
      }

      if (existing) {
        const res = await apiClient.put(`/library/${existing.id}`, { status: targetStatus });
        setLibraryItems(prev => prev.map(li => li.id === existing.id ? res.data : li));
      } else {
        const res = await apiClient.post('/library/', {
          item_type: selectedItem.item_type,
          external_id: selectedItem.external_id,
          title: selectedItem.title,
          image_url: selectedItem.image_url,
          status: targetStatus
        });
        setLibraryItems(prev => [...prev, res.data]);
      }
    } catch(err) {
      console.error("Failed to toggle favorite", err);
    }
  };

  const handleSaveReview = async () => {
    if (!selectedItem) return;
    setIsSavingReview(true);
    try {
      await apiClient.post(`/reviews/${selectedItem.item_type}/${selectedItem.external_id}`, {
        rating: userRating || null,
        content: userComment || null
      });
      // Refresh reviews list
      const revRes = await apiClient.get(`/reviews/${selectedItem.item_type}/${selectedItem.external_id}`);
      setItemReviews(revRes.data);
      alert(language === 'es' ? 'Valoración guardada con éxito.' : 'Review saved successfully.');
    } catch(err) {
      console.error(err);
      alert(language === 'es' ? 'Error al guardar la valoración.' : 'Failed to save review.');
    } finally {
      setIsSavingReview(false);
    }
  };

  // Helper to parse JSON notes
  const parseNotes = (notes: string) => {
    try {
      if (notes.startsWith('{')) return JSON.parse(notes);
    } catch(e){}
    return { description: notes, sub_items: [] };
  };

  // Helper to clean HTML
  const stripHtml = (html: string) => {
    if (!html) return '';
    const clean = html.replace(/<[^>]*>/g, '');
    const txt = document.createElement('textarea');
    txt.innerHTML = clean;
    return txt.value;
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
        <p>{language === 'es' ? 'Cargando guía...' : 'Loading guide...'}</p>
      </div>
    );
  }

  if (errorMsg || !guide) {
    return (
      <div className="container" style={{ padding: '2rem 1rem', textAlign: 'center' }}>
        <button onClick={() => navigate(-1)} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} /> {language === 'es' ? 'Volver' : 'Back'}
        </button>
        <div className="glass-card" style={{ padding: '2rem', borderColor: '#ef4444' }}>
          <p style={{ color: '#ef4444' }}>{errorMsg || (language === 'es' ? 'Guía no encontrada.' : 'Guide not found.')}</p>
        </div>
      </div>
    );
  }

  const docFlowList = guide.section_descriptions?.flow || [];
  const itemsList = guide.items || [];

  // Helper to get all items under a section
  const getSectionItemIds = (sectionEl: any) => {
    const ids: number[] = [];
    const idx = docFlowList.findIndex((x: any) => x.id === sectionEl.id);
    if (idx === -1) return ids;
    for (let i = idx + 1; i < docFlowList.length; i++) {
      const el = docFlowList[i];
      if (el.type === 'section') break;
      if (el.type === 'block') {
        (el.items || []).forEach((item: any) => ids.push(item.id));
        (el.subblocks || []).forEach((sub: any) => {
          (sub.items || []).forEach((item: any) => ids.push(item.id));
        });
      }
    }
    return ids;
  };

  // Helper to get all items under a block
  const getBlockItemIds = (blockEl: any) => {
    const ids: number[] = [];
    (blockEl.items || []).forEach((item: any) => ids.push(item.id));
    (blockEl.subblocks || []).forEach((sub: any) => {
      (sub.items || []).forEach((item: any) => ids.push(item.id));
    });
    return ids;
  };

  // Helper to get all items under a subblock
  const getSubblockItemIds = (subblockEl: any) => {
    return (subblockEl.items || []).map((item: any) => item.id);
  };

  const isFavorite = selectedItem && libraryItems.some(li =>
    li.item_type === selectedItem.item_type &&
    li.external_id === selectedItem.external_id &&
    ['completed', 'read'].includes(li.status)
  );

  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '800px', margin: '0 auto' }}>
      {/* Header buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={16} /> {language === 'es' ? 'Volver' : 'Back'}
        </button>
      </div>

      <div className="glass-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
        {/* Title block */}
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem' }}>
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>{guide.title}</h1>
          {guide.description && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', margin: '0.5rem 0 0 0', fontStyle: 'italic', lineHeight: '1.4' }}>
              {guide.description}
            </p>
          )}
        </div>

        {/* Stats card */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Progreso Completado:' : 'Completed Progress:'}</span>
            <h4 style={{ margin: '0.25rem 0 0 0', fontSize: '1.35rem', fontWeight: 700 }}>
              {guide.completed_count} / {guide.total_count} ({guide.progress_percentage}%)
            </h4>
          </div>
          <div>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Creador:' : 'Creator:'}</span>
            <h4 style={{ margin: '0.25rem 0 0 0', fontSize: '1.35rem', fontWeight: 700, textTransform: 'capitalize' }}>
              {guide.creator_username}
            </h4>
          </div>
        </div>

        {/* Structured Flow List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginTop: '1rem' }}>
          {(() => {
            if (docFlowList.length === 0) {
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {itemsList.map((item: any) => {
                    return (
                      <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={item.is_completed}
                            onChange={() => handleToggleItemProgress(item.id)}
                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                          />
                          {item.image_url && (
                            <img
                              src={item.image_url}
                              alt={item.title}
                              onClick={() => setZoomedImage(item.image_url)}
                              style={{ width: '36px', height: '54px', objectFit: 'cover', borderRadius: '4px', cursor: 'zoom-in' }}
                            />
                          )}
                          <div style={{ flex: 1 }}>
                            <h5 style={{ margin: 0, fontSize: '0.95rem' }}>{item.title}</h5>
                          </div>
                          <button
                            onClick={() => handleOpenItemDetails(item)}
                            className="btn-secondary"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            {language === 'es' ? 'Ver info' : 'View info'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            }

            let currentSectionCollapsed = false;
            return docFlowList.map((el: any) => {
              if (el.type === 'section') {
                const sectionIds = getSectionItemIds(el);
                const isSectionCompleted = sectionIds.length > 0 && sectionIds.every((id: number) => itemsList.find((i: any) => i.id === id)?.is_completed);
                const isCollapsed = collapsedNodes[el.id] || false;
                currentSectionCollapsed = isCollapsed;
                
                return (
                  <div key={el.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginTop: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <button
                      onClick={() => toggleNodeCollapse(el.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}
                    >
                      {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                    </button>
                    {sectionIds.length > 0 && (
                      <input
                        type="checkbox"
                        checked={isSectionCompleted}
                        onChange={() => handleBulkToggle(sectionIds, !isSectionCompleted)}
                        style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <h3 style={{ color: 'var(--accent-primary)', fontSize: '1.25rem', margin: 0, fontWeight: 800 }}>
                        {el.title.toUpperCase() || (language === 'es' ? 'SECCIÓN SIN TÍTULO' : 'UNTITLED SECTION')}
                      </h3>
                      {el.description && <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '0.25rem 0 0 0' }}>{el.description}</p>}
                    </div>
                  </div>
                );
              }

              if (el.type === 'block') {
                if (currentSectionCollapsed) return null;

                const blockItemsIds = (el.items || []).map((i: any) => i.id);
                const blockItems = itemsList.filter((item: any) => blockItemsIds.includes(item.id));
                const allBlockIds = getBlockItemIds(el);
                const isBlockCompleted = allBlockIds.length > 0 && allBlockIds.every((id: number) => itemsList.find((i: any) => i.id === id)?.is_completed);
                const isCollapsed = collapsedNodes[el.id] || false;
                
                const priorityLabel = el.importance_rank && guide.importance_labels
                  ? guide.importance_labels[el.importance_rank.toString()]
                  : '';

                return (
                  <div key={el.id} style={{ paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <button
                        onClick={() => toggleNodeCollapse(el.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}
                      >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {allBlockIds.length > 0 && (
                        <input
                          type="checkbox"
                          checked={isBlockCompleted}
                          onChange={() => handleBulkToggle(allBlockIds, !isBlockCompleted)}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{el.title || (language === 'es' ? 'Bloque sin título' : 'Untitled Block')}</h4>
                          {priorityLabel && <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>({priorityLabel})</span>}
                        </div>
                        {el.description && <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>{el.description}</p>}
                      </div>
                    </div>

                    {!isCollapsed && (
                      <>
                        {/* Block Items */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1.5rem' }}>
                          {blockItems.map((item: any) => {
                            return (
                              <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.6rem', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={item.is_completed}
                                    onChange={() => handleToggleItemProgress(item.id)}
                                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                  />
                                  {item.image_url && (
                                    <img
                                      src={item.image_url}
                                      alt={item.title}
                                      onClick={() => setZoomedImage(item.image_url)}
                                      style={{ width: '32px', height: '48px', objectFit: 'cover', borderRadius: '4px', cursor: 'zoom-in' }}
                                    />
                                  )}
                                  <div style={{ flex: 1 }}>
                                    <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{item.title}</h5>
                                  </div>
                                  <button
                                    onClick={() => handleOpenItemDetails(item)}
                                    className="btn-secondary"
                                    style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                  >
                                    {language === 'es' ? 'Ver info' : 'View info'}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Nested Subblocks */}
                        {(el.subblocks || []).map((sub: any) => {
                          const subItemsIds = (sub.items || []).map((i: any) => i.id);
                          const subItems = itemsList.filter((item: any) => subItemsIds.includes(item.id));
                          const allSubblockIds = getSubblockItemIds(sub);
                          const isSubblockCompleted = allSubblockIds.length > 0 && allSubblockIds.every((id: number) => itemsList.find((i: any) => i.id === id)?.is_completed);
                          const isSubCollapsed = collapsedNodes[sub.id] || false;
                          
                          const subPriorityLabel = sub.importance_rank && guide.importance_labels
                            ? guide.importance_labels[sub.importance_rank.toString()]
                            : '';

                          return (
                            <div key={sub.id} style={{ marginLeft: '1.5rem', paddingLeft: '0.75rem', borderLeft: '2px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button
                                  onClick={() => toggleNodeCollapse(sub.id)}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}
                                >
                                  {isSubCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {allSubblockIds.length > 0 && (
                                  <input
                                    type="checkbox"
                                    checked={isSubblockCompleted}
                                    onChange={() => handleBulkToggle(allSubblockIds, !isSubblockCompleted)}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                  />
                                )}
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{sub.title || (language === 'es' ? 'Subbloque sin título' : 'Untitled Subblock')}</h5>
                                    {subPriorityLabel && <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 600 }}>({subPriorityLabel})</span>}
                                  </div>
                                  {sub.description && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>{sub.description}</p>}
                                </div>
                              </div>

                              {!isSubCollapsed && (
                                /* Subblock items */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1.25rem' }}>
                                  {subItems.map((item: any) => {
                                    return (
                                      <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.4rem 0.8rem', background: 'var(--bg-secondary)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                          <input
                                            type="checkbox"
                                            checked={item.is_completed}
                                            onChange={() => handleToggleItemProgress(item.id)}
                                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                          />
                                          {item.image_url && (
                                            <img
                                              src={item.image_url}
                                              alt={item.title}
                                              onClick={() => setZoomedImage(item.image_url)}
                                              style={{ width: '24px', height: '36px', objectFit: 'cover', borderRadius: '3px', cursor: 'zoom-in' }}
                                            />
                                          )}
                                          <div style={{ flex: 1 }}>
                                            <h6 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>{item.title}</h6>
                                          </div>
                                          <button
                                            onClick={() => handleOpenItemDetails(item)}
                                            className="btn-secondary"
                                            style={{ padding: '0.15rem 0.45rem', fontSize: '0.72rem' }}
                                          >
                                            {language === 'es' ? 'Ver info' : 'View info'}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                );
              }
              return null;
            });
          })()}
        </div>
      </div>

      {/* Standalone Item Details Modal (at the top) */}
      {selectedItem && (
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
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>{selectedItem.title}</h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', textTransform: 'uppercase', fontWeight: 700 }}>
                  {t('media' + selectedItem.item_type.charAt(0).toUpperCase() + selectedItem.item_type.slice(1))}
                </span>
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
                  const notes = parseNotes(selectedItem.custom_notes || '');
                  if (!notes.description) return null;
                  return (
                    <div>
                      <h5 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Descripción:' : 'Description:'}</h5>
                      <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                        {stripHtml(notes.description)}
                      </p>
                    </div>
                  );
                })()}

                {/* Star rating selector */}
                <div>
                  <h5 style={{ margin: '0 0 0.4rem 0', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Tu Calificación:' : 'Your Rating:'}</h5>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setUserRating(star)}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <Star
                          size={24}
                          fill={star <= userRating ? '#f59e0b' : 'none'}
                          color={star <= userRating ? '#f59e0b' : 'var(--text-muted)'}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Favorite toggler */}
                <div>
                  <button
                    onClick={handleToggleFavorite}
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
              </div>
            </div>

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
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3000,
            cursor: 'zoom-out'
          }}
        >
          <img
            src={zoomedImage}
            alt="Zoomed preview"
            style={{ maxHeight: '90vh', maxWidth: '90vw', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
          />
        </div>
      )}
    </div>
  );
};
export default ViewGuide;
