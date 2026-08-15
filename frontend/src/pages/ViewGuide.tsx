import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import {
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  Check,
  Heart
} from 'lucide-react';
import { ItemDetailsModal } from '../components/ItemDetailsModal';

export const ViewGuide: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const { language } = useTranslation();

  const [guide, setGuide] = useState<any | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isTogglingSave, setIsTogglingSave] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  // Standalone details modal states
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  const getPriorityLabel = (rank: number | null, lang: string) => {
    if (!rank) return '';
    switch (rank) {
      case 1: return lang === 'es' ? 'Extra' : 'Extra';
      case 2: return lang === 'es' ? 'Opcional' : 'Optional';
      case 3: return lang === 'es' ? 'Recomendado' : 'Recommended';
      case 4: return lang === 'es' ? 'Importante' : 'Important';
      case 5: return lang === 'es' ? 'Obligatorio' : 'Mandatory';
      default: return '';
    }
  };

  const handleToggleSaveGuide = async () => {
    if (!guide || isTogglingSave) return;
    setIsTogglingSave(true);
    const nextState = !isSaved;
    setIsSaved(nextState);
    try {
      if (isSaved) {
        await apiClient.delete(`/lists/${guide.id}/save`);
      } else {
        await apiClient.post(`/lists/${guide.id}/save`);
      }
    } catch (err) {
      setIsSaved(!nextState);
      console.error("Failed to toggle guide follow/save", err);
    } finally {
      setIsTogglingSave(false);
    }
  };

  const fetchListDetails = () => {
    if (!id) return;
    apiClient.get(`/lists/${id}`)
      .then(response => {
        setGuide(response.data);
        setIsSaved(!!response.data.is_saved_by_me);
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
  };

  // Fetch guide details and profile information on mount
  useEffect(() => {
    setLoading(true);
    setErrorMsg('');
    fetchListDetails();

    // Fetch user profile
    apiClient.get('/users/me')
      .then(res => setCurrentUser(res.data))
      .catch(e => console.error(e));
  }, [id, language]);

  useEffect(() => {
    const currentFlow = guide?.section_descriptions?.flow;
    if (hash && currentFlow && currentFlow.length > 0) {
      setTimeout(() => {
        const elId = hash.replace('#', '');
        const element = document.getElementById(elId);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('highlight-animation');
          setTimeout(() => element.classList.remove('highlight-animation'), 2500);
        }
      }, 500);
    }
  }, [hash, guide]);

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

    } catch (err: any) {
      setErrorMsg(language === 'es' ? 'Error al actualizar el progreso.' : 'Failed to update bulk progress.');
    }
  };

  const handleOpenItemDetails = (item: any) => {
    setSelectedItem({ ...item, list_id: parseInt(id as string, 10) });
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

  const getBlockItemIds = (blockEl: any) => {
    const ids: number[] = [];
    (blockEl.items || []).forEach((item: any) => ids.push(item.id));
    (blockEl.subblocks || []).forEach((sub: any) => {
      (sub.items || []).forEach((item: any) => ids.push(item.id));
    });
    return ids;
  };

  const getSubblockItemIds = (subblockEl: any) => {
    return (subblockEl.items || []).map((item: any) => item.id);
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button onClick={() => navigate(-1)} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
          <ArrowLeft size={16} /> {language === 'es' ? 'Volver' : 'Back'}
        </button>
      </div>

      <div className="glass-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>{guide.title}</h1>
            {guide.description && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', margin: '0.5rem 0 0 0', fontStyle: 'italic', lineHeight: '1.4' }}>
                {guide.description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleToggleSaveGuide}
            disabled={isTogglingSave}
            title={isSaved ? (language === 'es' ? 'Dejar de seguir guía' : 'Unfollow guide') : (language === 'es' ? 'Seguir guía' : 'Follow guide')}
            style={{
              background: isSaved ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-secondary)',
              border: isSaved ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)',
              color: isSaved ? '#ef4444' : 'var(--text-secondary)',
              borderRadius: '50%',
              width: '42px',
              height: '42px',
              minWidth: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: isSaved ? '0 0 14px rgba(239, 68, 68, 0.35)' : 'none',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              if (!isSaved) {
                (e.currentTarget as HTMLElement).style.color = '#ef4444';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239, 68, 68, 0.4)';
                (e.currentTarget as HTMLElement).style.background = 'rgba(239, 68, 68, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaved) {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)';
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)';
              }
            }}
          >
            <Heart size={22} fill={isSaved ? '#ef4444' : 'none'} />
          </button>
        </div>

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
                  <div id={el.id} key={el.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginTop: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', transition: 'background-color 2.5s ease-out' }}>
                    <button
                      onClick={() => toggleNodeCollapse(el.id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}
                    >
                      {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                    </button>
                    {sectionIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => handleBulkToggle(sectionIds, !isSectionCompleted)}
                        style={{
                          background: isSectionCompleted ? '#10b981' : 'transparent',
                          border: isSectionCompleted ? 'none' : '1px solid var(--border-color)',
                          borderRadius: '50%',
                          width: '22px',
                          height: '22px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          color: isSectionCompleted ? 'white' : 'transparent',
                          transition: 'all 0.2s ease',
                          padding: 0
                        }}
                      >
                        <Check size={14} strokeWidth={3} />
                      </button>
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
                const blockItems = blockItemsIds.map((id: number) => itemsList.find((i: any) => i.id === id)).filter(Boolean);
                const allBlockIds = getBlockItemIds(el);
                const isBlockCompleted = allBlockIds.length > 0 && allBlockIds.every((id: number) => itemsList.find((i: any) => i.id === id)?.is_completed);
                const isCollapsed = collapsedNodes[el.id] || false;
                
                const priorityLabel = getPriorityLabel(el.importance_rank, language);

                return (
                  <div id={el.id} key={el.id} style={{ paddingLeft: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', transition: 'background-color 2.5s ease-out', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <button
                        onClick={() => toggleNodeCollapse(el.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}
                      >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                      </button>
                      {allBlockIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleBulkToggle(allBlockIds, !isBlockCompleted)}
                          style={{
                            background: isBlockCompleted ? '#10b981' : 'transparent',
                            border: isBlockCompleted ? 'none' : '1px solid var(--border-color)',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: isBlockCompleted ? 'white' : 'transparent',
                            transition: 'all 0.2s ease',
                            padding: 0
                          }}
                        >
                          <Check size={12} strokeWidth={3} />
                        </button>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1.5rem' }}>
                          {blockItems.map((item: any) => {
                            return (
                              <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.6rem', background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleItemProgress(item.id)}
                                    style={{
                                      background: item.is_completed ? '#10b981' : 'transparent',
                                      border: item.is_completed ? 'none' : '1px solid var(--border-color)',
                                      borderRadius: '50%',
                                      width: '20px',
                                      height: '20px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      color: item.is_completed ? 'white' : 'transparent',
                                      transition: 'all 0.2s ease',
                                      padding: 0
                                    }}
                                  >
                                    <Check size={12} strokeWidth={3} />
                                  </button>
                                  {item.image_url && (
                                    <img
                                      src={item.image_url}
                                      alt={item.title}
                                      onClick={() => setZoomedImage(item.image_url)}
                                      style={{ width: '32px', height: '48px', objectFit: 'cover', borderRadius: '4px', cursor: 'zoom-in' }}
                                    />
                                  )}
                                  <div style={{ flex: 1 }}>
                                    {(() => {
                                      const match = (item.title || '').match(/^(.*?)\s*-\s*S(\d+)E(\d+)(.*)$/i);
                                      if (match) {
                                        const series = match[1].trim();
                                        const s = match[2];
                                        const e = match[3];
                                        const epName = match[4].replace(/^\s*-\s*/, '').trim();
                                        const formattedSE = language === 'es' ? `T${s} | E${e}` : `S${s} | E${e}`;
                                        return (
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>{series}</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{formattedSE}</span>
                                            {epName && <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{epName}</span>}
                                          </div>
                                        );
                                      }
                                      return <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{item.title}</h5>;
                                    })()}
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

                        {(el.subblocks || []).map((sub: any) => {
                          const subItemsIds = (sub.items || []).map((i: any) => i.id);
                          const subItems = subItemsIds.map((id: number) => itemsList.find((i: any) => i.id === id)).filter(Boolean);
                          const allSubblockIds = getSubblockItemIds(sub);
                          const isSubblockCompleted = allSubblockIds.length > 0 && allSubblockIds.every((id: number) => itemsList.find((i: any) => i.id === id)?.is_completed);
                          const isSubCollapsed = collapsedNodes[sub.id] || false;
                          
                          const subPriorityLabel = getPriorityLabel(sub.importance_rank, language);

                          return (
                            <div id={sub.id} key={sub.id} style={{ marginLeft: '1.5rem', paddingLeft: '0.75rem', borderLeft: '2px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem', transition: 'background-color 2.5s ease-out', borderRadius: '8px' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <button
                                  onClick={() => toggleNodeCollapse(sub.id)}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}
                                >
                                  {isSubCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                </button>
                                {allSubblockIds.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleBulkToggle(allSubblockIds, !isSubblockCompleted)}
                                    style={{
                                      background: isSubblockCompleted ? '#10b981' : 'transparent',
                                      border: isSubblockCompleted ? 'none' : '1px solid var(--border-color)',
                                      borderRadius: '50%',
                                      width: '18px',
                                      height: '18px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      cursor: 'pointer',
                                      color: isSubblockCompleted ? 'white' : 'transparent',
                                      transition: 'all 0.2s ease',
                                      padding: 0
                                    }}
                                  >
                                    <Check size={12} strokeWidth={3} />
                                  </button>
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1.25rem' }}>
                                  {subItems.map((item: any) => {
                                    return (
                                      <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.4rem 0.8rem', background: 'var(--bg-secondary)', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                          <button
                                            type="button"
                                            onClick={() => handleToggleItemProgress(item.id)}
                                            style={{
                                              background: item.is_completed ? '#10b981' : 'transparent',
                                              border: item.is_completed ? 'none' : '1px solid var(--border-color)',
                                              borderRadius: '50%',
                                              width: '18px',
                                              height: '18px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              cursor: 'pointer',
                                              color: item.is_completed ? 'white' : 'transparent',
                                              transition: 'all 0.2s ease',
                                              padding: 0
                                            }}
                                          >
                                            <Check size={12} strokeWidth={3} />
                                          </button>
                                          {item.image_url && (
                                            <img
                                              src={item.image_url}
                                              alt={item.title}
                                              onClick={() => setZoomedImage(item.image_url)}
                                              style={{ width: '24px', height: '36px', objectFit: 'cover', borderRadius: '3px', cursor: 'zoom-in' }}
                                            />
                                          )}
                                          <div style={{ flex: 1 }}>
                                            {(() => {
                                              const match = (item.title || '').match(/^(.*?)\s*-\s*S(\d+)E(\d+)(.*)$/i);
                                              if (match) {
                                                const series = match[1].trim();
                                                const s = match[2];
                                                const e = match[3];
                                                const epName = match[4].replace(/^\s*-\s*/, '').trim();
                                                const formattedSE = language === 'es' ? `T${s} | E${e}` : `S${s} | E${e}`;
                                                return (
                                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{series}</span>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>{formattedSE}</span>
                                                    {epName && <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{epName}</span>}
                                                  </div>
                                                );
                                              }
                                              return <h6 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>{item.title}</h6>;
                                            })()}
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

      {selectedItem && (
        <ItemDetailsModal
          item={selectedItem}
          isOwnProfile={!!currentUser}
          onClose={() => setSelectedItem(null)}
          onUpdate={() => fetchListDetails()}
          onOpenItem={(item) => setSelectedItem(item)}
        />
      )}

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
