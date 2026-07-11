import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import {
  ArrowRight,
  PlusCircle,
  AlertCircle,
  CheckCircle,
  FolderPlus,
  Trash2,
  Search as SearchIcon,
  BookOpen,
  LayoutGrid,
  Save,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface CreatedGuide {
  id: number;
  title: string;
  description: string;
  visibility: string;
  importance_labels: Record<string, string>;
  section_importances: Record<string, number>;
  section_descriptions: any; // Will store the rich document JSON structure
  items: any[];
}

interface DocElement {
  id: string;
  type: 'section' | 'block' | 'subblock';
  title: string;
  description: string;
  importance_rank?: number | null;
  items?: any[]; // For blocks/subblocks containing media items
  subblocks?: DocElement[]; // Nested subblocks (only inside blocks)
}

const stripHtml = (html: string) => {
  if (!html) return '';
  const clean = html.replace(/<[^>]*>/g, '');
  const txt = document.createElement('textarea');
  txt.innerHTML = clean;
  return txt.value;
};

export const CreateGuide: React.FC = () => {
  const { t, language } = useTranslation();

  // Step 1: Create Guide state
  const [guide, setGuide] = useState<CreatedGuide | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  const [showCustomLabels, setShowCustomLabels] = useState(false);

  // Custom priority labels state
  const [label1, setLabel1] = useState(language === 'es' ? 'Lectura Opcional' : 'Optional Reading');
  const [label2, setLabel2] = useState(language === 'es' ? 'Lectura Recomendada' : 'Recommended Reading');
  const [label3, setLabel3] = useState(language === 'es' ? 'Lectura Altamente Recomendada' : 'Highly Recommended');
  const [label4, setLabel4] = useState(language === 'es' ? 'Lectura Importante' : 'Important Reading');
  const [label5, setLabel5] = useState(language === 'es' ? 'Lectura Obligatoria' : 'Mandatory Reading');

  // Step 2: Word-style Document Flow Editor state
  const [docFlow, setDocFlow] = useState<DocElement[]>([]);

  // Real-time search modal states (inside editor)
  const [searchTarget, setSearchTarget] = useState<{ elementId: string; subblockId?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSearchTab, setActiveSearchTab] = useState<'all' | 'movie' | 'series' | 'anime' | 'book' | 'comic' | 'manga' | 'game'>('all');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTab, setSearchTab] = useState<'search' | 'manual'>('search');
  const [manualTitle, setManualTitle] = useState('');
  const [manualType, setManualType] = useState('comic');

  const [modalSuccessMsg, setModalSuccessMsg] = useState('');
  const [expandedMediaId, setExpandedMediaId] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // TV Series episode search details
  const [expandedSeriesId, setExpandedSeriesId] = useState<string | null>(null);
  const [expandedEpisodes, setExpandedEpisodes] = useState<any[]>([]);
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  const parseError = (err: any) => {
    const detail = err.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ');
    }
    return detail || err.message || 'An error occurred';
  };
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit') || searchParams.get('id');

  // Load existing guide if editing (fetch the draft state)
  useEffect(() => {
    if (editId) {
      setIsSubmitting(true);
      setErrorMsg('');
      apiClient.get(`/lists/${editId}`, { params: { draft: true } })
        .then(response => {
          setGuide(response.data);
          setTitle(response.data.title);
          setDescription(response.data.description);
        })
        .catch(() => {
          setErrorMsg(language === 'es' ? 'Error al cargar la guía.' : 'Error loading guide.');
        })
        .finally(() => {
          setIsSubmitting(false);
        });
    }
  }, [editId]);

  // Load document flow if it exists on the guide
  useEffect(() => {
    if (guide) {
      const savedStructure = guide.section_descriptions;
      const flowToLoad = (savedStructure && Array.isArray(savedStructure.draft_flow))
        ? savedStructure.draft_flow
        : (savedStructure && Array.isArray(savedStructure.flow) ? savedStructure.flow : []);
      setDocFlow(flowToLoad);
    }
  }, [guide]);

  const getAddedExternalIds = () => {
    const ids: string[] = [];
    docFlow.forEach(el => {
      if (el.type === 'block') {
        (el.items || []).forEach(item => {
          if (item.external_id) ids.push(item.external_id);
        });
        (el.subblocks || []).forEach(sub => {
          (sub.items || []).forEach(item => {
            if (item.external_id) ids.push(item.external_id);
          });
        });
      }
    });
    return ids;
  };
  const addedIds = getAddedExternalIds();


  // Debounced auto-save to database draft_flow in background
  useEffect(() => {
    if (!guide) return;

    // Prevent immediate save on initial mount
    if (!lastSavedTime && docFlow.length === 0 && title === guide.title) {
      setLastSavedTime(new Date().toLocaleTimeString());
      return;
    }

    setIsAutoSaving(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const updatedSecDesc = {
          ...guide.section_descriptions,
          draft_flow: docFlow,
          draft_title: title.trim(),
          draft_description: description.trim()
        };
        await apiClient.put(`/lists/${guide.id}`, {
          section_descriptions: updatedSecDesc
        });
        setGuide(prev => prev ? { ...prev, section_descriptions: updatedSecDesc } : null);
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (e) {
        console.error("Auto-save failed", e);
      } finally {
        setIsAutoSaving(false);
      }
    }, 1500);

    return () => clearTimeout(delayDebounce);
  }, [docFlow, title, description, guide?.id]);

  const handleCreateGuideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const importanceLabels = {
        "1": label1,
        "2": label2,
        "3": label3,
        "4": label4,
        "5": label5
      };

      const response = await apiClient.post('/lists/', {
        title,
        description,
        visibility, // Enforced as draft in backend, which saves this value in intended_visibility
        importance_labels: importanceLabels,
        section_descriptions: {
          flow: [],
          draft_flow: [],
          draft_title: title.trim(),
          draft_description: description.trim(),
          intended_visibility: visibility
        }
      });
      setGuide(response.data);
      setSuccessMsg(language === 'es' ? '¡Guía creada con éxito en modo Borrador!' : 'Guide created successfully as Draft!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(parseError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishGuide = async () => {
    if (!guide) return;
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const targetVis = guide.section_descriptions?.intended_visibility || 'public';
      const updatedSecDesc = {
        ...guide.section_descriptions,
        flow: docFlow,
        draft_flow: docFlow,
        draft_title: title.trim(),
        draft_description: description.trim()
      };
      
      const response = await apiClient.put(`/lists/${guide.id}`, {
        title: title.trim(),
        description: description.trim(),
        visibility: targetVis,
        section_descriptions: updatedSecDesc
      });
      setGuide(response.data);
      setSuccessMsg(language === 'es' ? '¡Cambios publicados con éxito!' : 'Guide published successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(parseError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Document actions
  const addSection = () => {
    const newSec: DocElement = {
      id: `sec-${Date.now()}`,
      type: 'section',
      title: '',
      description: ''
    };
    setDocFlow(prev => [...prev, newSec]);
  };

  const addBlock = () => {
    const newBlk: DocElement = {
      id: `blk-${Date.now()}`,
      type: 'block',
      title: '',
      description: '',
      importance_rank: 3,
      items: [],
      subblocks: []
    };
    setDocFlow(prev => [...prev, newBlk]);
  };

  const addSubblock = (blockId: string) => {
    setDocFlow(prev => prev.map(el => {
      if (el.id === blockId && el.type === 'block') {
        const newSub: DocElement = {
          id: `sub-${Date.now()}`,
          type: 'subblock',
          title: '',
          description: '',
          importance_rank: 3,
          items: []
        };
        return {
          ...el,
          subblocks: [...(el.subblocks || []), newSub]
        };
      }
      return el;
    }));
  };

  const updateDocElement = (id: string, fields: Partial<DocElement>, subblockId?: string) => {
    setDocFlow(prev => prev.map(el => {
      if (subblockId) {
        // We are updating a nested subblock inside a block
        if (el.id === id && el.type === 'block') {
          return {
            ...el,
            subblocks: (el.subblocks || []).map(sub => {
              if (sub.id === subblockId) {
                return { ...sub, ...fields };
              }
              return sub;
            })
          };
        }
      } else {
        // We are updating a main block/section
        if (el.id === id) {
          return { ...el, ...fields };
        }
      }
      return el;
    }));
  };

  const removeDocElement = (id: string, subblockId?: string) => {
    setDocFlow(prev => {
      if (subblockId) {
        return prev.map(el => {
          if (el.id === id && el.type === 'block') {
            return {
              ...el,
              subblocks: (el.subblocks || []).filter(sub => sub.id !== subblockId)
            };
          }
          return el;
        });
      } else {
        return prev.filter(el => el.id !== id);
      }
    });
  };

  // Media API search handlers
  const openSearchModal = (elementId: string, subblockId?: string) => {
    setSearchTarget({ elementId, subblockId });
    setSearchQuery('');
    setSearchResults([]);
    setSearchTab('search');
    setManualTitle('');
  };

  const triggerSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setErrorMsg('');
    setManualTitle(searchQuery);
    try {
      const response = await apiClient.get('/search/all', {
        params: { q: searchQuery }
      });
      setSearchResults(response.data);
    } catch (err: any) {
      setErrorMsg(language === 'es' ? 'Error al buscar en la API.' : 'Search failed.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadSeriesEpisodes = async (seriesId: string) => {
    if (expandedSeriesId === seriesId) {
      setExpandedSeriesId(null);
      setExpandedEpisodes([]);
      return;
    }
    setExpandedSeriesId(seriesId);
    setIsLoadingEpisodes(true);
    try {
      const res = await apiClient.get(`/search/series/${seriesId}/season/1`);
      setExpandedEpisodes(res.data || []);
    } catch (err) {
      console.error(err);
      alert(language === 'es' ? 'Error al cargar los episodios.' : 'Error loading episodes.');
    } finally {
      setIsLoadingEpisodes(false);
    }
  };

  const handleSelectMediaItem = async (media: any) => {
    if (!guide || !searchTarget) return;

    setErrorMsg('');
    setSuccessMsg('');
    try {
      // Create ListItem in backend database
      const response = await apiClient.post(`/lists/${guide.id}/items`, {
        item_type: media.item_type,
        external_id: media.external_id,
        title: media.title,
        image_url: media.image_url,
        custom_notes: media.description,
        section: null,
        importance_rank: null,
        order_index: 0
      });

      const newItem = response.data;

      // Insert item into the correct block/subblock in docFlow state
      setDocFlow(prev => prev.map(el => {
        if (searchTarget.subblockId) {
          // Inside subblock
          if (el.id === searchTarget.elementId && el.type === 'block') {
            return {
              ...el,
              subblocks: (el.subblocks || []).map(sub => {
                if (sub.id === searchTarget.subblockId) {
                  return {
                    ...sub,
                    items: [...(sub.items || []), newItem]
                  };
                }
                return sub;
              })
            };
          }
        } else {
          // Inside block
          if (el.id === searchTarget.elementId && el.type === 'block') {
            return {
              ...el,
              items: [...(el.items || []), newItem]
            };
          }
        }
        return el;
      }));

      setModalSuccessMsg(language === 'es' ? `¡${media.title} añadido!` : `${media.title} added!`);
      setManualTitle('');
      setTimeout(() => setModalSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(language === 'es' ? 'No se pudo guardar el elemento.' : 'Failed to save element.');
    }
  };

  const removeMediaItem = (blockId: string, itemId: number, subblockId?: string) => {
    setDocFlow(prev => prev.map(el => {
      if (subblockId) {
        if (el.id === blockId && el.type === 'block') {
          return {
            ...el,
            subblocks: (el.subblocks || []).map(sub => {
              if (sub.id === subblockId) {
                return {
                  ...sub,
                  items: (sub.items || []).filter(item => item.id !== itemId)
                };
              }
              return sub;
            })
          };
        }
      } else {
        if (el.id === blockId && el.type === 'block') {
          return {
            ...el,
            items: (el.items || []).filter(item => item.id !== itemId)
          };
        }
      }
      return el;
    }));
  };

  // Reorder docFlow elements
  const moveDocElement = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === docFlow.length - 1) return;

    const newFlow = [...docFlow];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newFlow[index];
    newFlow[index] = newFlow[targetIndex];
    newFlow[targetIndex] = temp;
    setDocFlow(newFlow);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 0', display: 'flex', flexDirection: 'column', gap: '2rem', textAlign: 'left' }}>
      
      {errorMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.75rem', borderRadius: 8, fontSize: '0.9rem' }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* STEP 1: CREATE GUIDE DETAILS FORM */}
      {!guide ? (
        <form onSubmit={handleCreateGuideSubmit} className="glass-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h2>{language === 'es' ? 'Crear Nueva Guía' : 'Create New Guide'}</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{language === 'es' ? 'Título de la Guía' : 'Guide Title'}</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder={language === 'es' ? 'Ej. Mis películas favoritas, Batman: Orden de lectura completo...' : 'e.g. My favorite movies, Batman reading order...'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{language === 'es' ? 'Descripción' : 'Description'}</label>
            <textarea
              className="input-field"
              rows={3}
              placeholder={language === 'es' ? 'De qué se trata esta guía...' : 'What this guide is about...'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{language === 'es' ? 'Visibilidad' : 'Visibility'}</label>
            <select
              className="input-field"
              value={visibility}
              onChange={(e: any) => setVisibility(e.target.value)}
            >
              <option value="public">{language === 'es' ? 'Pública' : 'Public'}</option>
              <option value="private">{language === 'es' ? 'Privada' : 'Private'}</option>
            </select>
          </div>

          {/* Scale customization checkbox */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="customScaleCheck"
                checked={showCustomLabels}
                onChange={(e) => setShowCustomLabels(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="customScaleCheck" style={{ fontSize: '0.9rem', cursor: 'pointer', fontWeight: 500 }}>
                {language === 'es' ? 'Personalizar escala de importancia' : 'Customize importance scale'}
              </label>
            </div>

            {showCustomLabels && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                  {language === 'es' ? 'Asigna nombres específicos a las 5 prioridades de tu lista/guía.' : 'Assign specific names to the 5 priorities of your list/guide.'}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem' }}>{language === 'es' ? 'Nivel 1' : 'Level 1'}</label>
                    <input type="text" className="input-field" value={label1} onChange={(e) => setLabel1(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem' }}>{language === 'es' ? 'Nivel 2' : 'Level 2'}</label>
                    <input type="text" className="input-field" value={label2} onChange={(e) => setLabel2(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem' }}>{language === 'es' ? 'Nivel 3' : 'Level 3'}</label>
                    <input type="text" className="input-field" value={label3} onChange={(e) => setLabel3(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem' }}>{language === 'es' ? 'Nivel 4' : 'Level 4'}</label>
                    <input type="text" className="input-field" value={label4} onChange={(e) => setLabel4(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem' }}>{language === 'es' ? 'Nivel 5' : 'Level 5'}</label>
                    <input type="text" className="input-field" value={label5} onChange={(e) => setLabel5(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ marginTop: '1rem' }}>
            {language === 'es' ? 'Crear Guía' : 'Create Guide'} <ArrowRight size={18} />
          </button>
        </form>
      ) : (
        /* STEP 2: RICH DOCUMENT-STYLE EDITOR CANVAS */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Editor Header Tools */}
          <div className="glass-card" style={{ padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', position: 'sticky', top: '75px', zIndex: 100 }}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={addSection} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                <FolderPlus size={16} /> {language === 'es' ? '+ Nueva Sección' : '+ New Section'}
              </button>
              <button onClick={addBlock} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                <LayoutGrid size={16} /> {language === 'es' ? '+ Nuevo Bloque' : '+ New Block'}
              </button>
            </div>
            
            {/* Auto-save status indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              {isAutoSaving ? (
                <span>{language === 'es' ? 'Guardando borrador...' : 'Saving draft...'}</span>
              ) : lastSavedTime ? (
                <span>{language === 'es' ? `Borrador guardado: ${lastSavedTime}` : `Draft auto-saved: ${lastSavedTime}`}</span>
              ) : null}
            </div>

            {/* Target visibility selector & Publish action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <select
                className="input-field"
                value={guide?.section_descriptions?.intended_visibility || 'public'}
                onChange={(e) => {
                  const newInt = e.target.value;
                  setGuide((prev: any) => {
                    if (!prev) return null;
                    return {
                      ...prev,
                      section_descriptions: {
                        ...prev.section_descriptions,
                        intended_visibility: newInt
                      }
                    };
                  });
                }}
                style={{ width: '110px', fontSize: '0.82rem', padding: '0.25rem 0.5rem', height: '38px', margin: 0 }}
              >
                <option value="public">{language === 'es' ? 'Pública' : 'Public'}</option>
                <option value="private">{language === 'es' ? 'Privada' : 'Private'}</option>
              </select>

              <button onClick={handlePublishGuide} disabled={isSubmitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', height: '38px' }}>
                <Save size={16} /> {isSubmitting ? '...' : language === 'es' ? 'Publicar Cambios' : 'Publish Changes'}
              </button>
            </div>
          </div>

          {/* Document Canvas Container */}
          <div className="glass-card" style={{ padding: '3rem', minHeight: '600px', display: 'flex', flexDirection: 'column', gap: '2.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            
            {/* Title Block */}
            <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '1.5rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (guide) {
                    setGuide({ ...guide, title: e.target.value });
                  }
                }}
                style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', background: 'transparent', border: 'none', borderBottom: '1px dashed var(--border-color)', outline: 'none', width: '100%' }}
                placeholder={language === 'es' ? 'Título de la Guía' : 'Guide Title'}
              />
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (guide) {
                    setGuide({ ...guide, description: e.target.value });
                  }
                }}
                style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', outline: 'none', width: '100%', resize: 'none', fontStyle: 'italic', lineHeight: 1.5 }}
                placeholder={language === 'es' ? 'Escribe la descripción general de la guía...' : 'Write guide general description...'}
                rows={2}
              />
            </div>

            {/* Document Flow Elements */}
            {docFlow.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--text-secondary)' }}>
                <BookOpen size={48} style={{ strokeWidth: 1, marginBottom: '1rem', color: 'var(--text-muted)' }} />
                <p style={{ margin: 0, fontSize: '1.05rem' }}>
                  {language === 'es' ? 'Tu documento está vacío. Utiliza los botones de arriba para añadir Secciones o Bloques.' : 'Your document is empty. Use the buttons above to add Sections or Blocks.'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                {docFlow.map((element, index) => {
                  
                  // SECTION ELEMENT RENDER
                  if (element.type === 'section') {
                    return (
                      <div key={element.id} className="document-section-block" style={{ padding: '1.5rem', background: 'rgba(124,58,237,0.03)', borderLeft: '4px solid var(--accent-primary)', position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderRadius: '0 8px 8px 0' }}>
                        
                        {/* Control actions */}
                        <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.35rem' }}>
                          <button onClick={() => moveDocElement(index, 'up')} disabled={index === 0} className="btn-secondary" style={{ padding: '0.2rem 0.4rem' }}><ChevronUp size={14} /></button>
                          <button onClick={() => moveDocElement(index, 'down')} disabled={index === docFlow.length - 1} className="btn-secondary" style={{ padding: '0.2rem 0.4rem' }}><ChevronDown size={14} /></button>
                          <button onClick={() => removeDocElement(element.id)} className="btn-secondary" style={{ padding: '0.2rem 0.4rem', color: '#ef4444' }}><Trash2 size={14} /></button>
                        </div>

                        {/* Title Input */}
                        <input
                          type="text"
                          value={element.title}
                          onChange={(e) => updateDocElement(element.id, { title: e.target.value })}
                          style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-primary)', background: 'transparent', border: 'none', borderBottom: '1px dashed var(--border-color)', outline: 'none', width: '80%', padding: '0.2rem 0' }}
                          placeholder={language === 'es' ? 'Nueva sección' : 'New section'}
                        />

                        {/* Description Input */}
                        <textarea
                          value={element.description}
                          onChange={(e) => updateDocElement(element.id, { description: e.target.value })}
                          style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', borderBottom: '1px dashed transparent', outline: 'none', width: '100%', resize: 'none', fontStyle: 'italic', lineHeight: 1.5 }}
                          placeholder={language === 'es' ? 'Escribe la descripción de esta sección...' : 'Write description for this section...'}
                          rows={2}
                        />
                      </div>
                    );
                  }

                  // BLOCK ELEMENT RENDER
                  if (element.type === 'block') {
                    return (
                      <div key={element.id} style={{ padding: '2rem', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-primary)', position: 'relative', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        
                        {/* Control actions */}
                        <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.35rem' }}>
                          <button onClick={() => moveDocElement(index, 'up')} disabled={index === 0} className="btn-secondary" style={{ padding: '0.2rem 0.4rem' }}><ChevronUp size={14} /></button>
                          <button onClick={() => moveDocElement(index, 'down')} disabled={index === docFlow.length - 1} className="btn-secondary" style={{ padding: '0.2rem 0.4rem' }}><ChevronDown size={14} /></button>
                          <button onClick={() => removeDocElement(element.id)} className="btn-secondary" style={{ padding: '0.2rem 0.4rem', color: '#ef4444' }}><Trash2 size={14} /></button>
                        </div>

                         {/* Top row: Title and importance */}
                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap', width: '85%' }}>
                          <input
                            type="text"
                            value={element.title}
                            onChange={(e) => updateDocElement(element.id, { title: e.target.value })}
                            style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', background: 'transparent', border: 'none', borderBottom: '1px dashed var(--border-color)', outline: 'none', flex: 1, padding: '0.2rem 0' }}
                            placeholder={language === 'es' ? 'Nuevo bloque' : 'New block'}
                          />

                          {/* Importance scale */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Importancia:' : 'Importance:'}</span>
                            <select
                              value={element.importance_rank || ''}
                              onChange={(e) => updateDocElement(element.id, { importance_rank: e.target.value ? parseInt(e.target.value) : null })}
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                            >
                              <option value="1">1 - {label1}</option>
                              <option value="2">2 - {label2}</option>
                              <option value="3">3 - {label3}</option>
                              <option value="4">4 - {label4}</option>
                              <option value="5">5 - {label5}</option>
                            </select>
                          </div>
                        </div>

                        {/* Description */}
                        <textarea
                          value={element.description}
                          onChange={(e) => updateDocElement(element.id, { description: e.target.value })}
                          style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', outline: 'none', width: '100%', resize: 'none', lineHeight: 1.45 }}
                          placeholder={language === 'es' ? 'Escribe la descripción de este bloque...' : 'Write description for this block...'}
                          rows={2}
                        />

                        {/* List of Media items in Block */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {(element.items || []).map((item) => (
                            <div key={item.id} style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                              {item.image_url && (
                                <img
                                  src={item.image_url}
                                  alt={item.title}
                                  onClick={() => setZoomedImage(item.image_url)}
                                  style={{ width: '32px', height: '48px', objectFit: 'cover', borderRadius: '4px', cursor: 'zoom-in' }}
                                />
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</h5>
                                <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', textTransform: 'capitalize' }}>{item.item_type}</span>
                              </div>
                              <button onClick={() => removeMediaItem(element.id, item.id)} className="btn-secondary" style={{ padding: '0.2rem 0.4rem', border: 'none', background: 'transparent', color: '#ef4444' }}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))}

                          <button type="button" onClick={() => openSearchModal(element.id)} className="btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', marginTop: '0.25rem' }}>
                            <SearchIcon size={14} /> {language === 'es' ? 'Buscar y Añadir Obra' : 'Search & Add Item'}
                          </button>
                        </div>

                        {/* Nested Subblocks */}
                        {(element.subblocks || []).map((sub) => (
                          <div key={sub.id} style={{ marginLeft: '2rem', padding: '1.25rem', borderLeft: '2px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                            
                            <button onClick={() => removeDocElement(element.id, sub.id)} className="btn-secondary" style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', padding: '0.2rem 0.4rem', color: '#ef4444', border: 'none', background: 'transparent' }}><Trash2 size={14} /></button>

                            {/* Subblock Top row: Title and importance */}
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', width: '90%' }}>
                              <input
                                type="text"
                                value={sub.title}
                                onChange={(e) => updateDocElement(element.id, { title: e.target.value }, sub.id)}
                                style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', background: 'transparent', border: 'none', borderBottom: '1px dashed var(--border-color)', outline: 'none', flex: 1, padding: '0.2rem 0' }}
                                placeholder={language === 'es' ? 'Nuevo subbloque' : 'New subblock'}
                              />

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{language === 'es' ? 'Importancia:' : 'Importance:'}</span>
                                <select
                                  value={sub.importance_rank || ''}
                                  onChange={(e) => updateDocElement(element.id, { importance_rank: e.target.value ? parseInt(e.target.value) : null }, sub.id)}
                                  style={{ padding: '0.15rem 0.4rem', fontSize: '0.75rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                >
                                  <option value="1">1 - {label1}</option>
                                  <option value="2">2 - {label2}</option>
                                  <option value="3">3 - {label3}</option>
                                  <option value="4">4 - {label4}</option>
                                  <option value="5">5 - {label5}</option>
                                </select>
                              </div>
                            </div>

                            {/* Subblock Description */}
                            <textarea
                              value={sub.description}
                              onChange={(e) => updateDocElement(element.id, { description: e.target.value }, sub.id)}
                              style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', outline: 'none', width: '100%', resize: 'none', lineHeight: 1.4 }}
                              placeholder={language === 'es' ? 'Escribe la descripción de este subbloque...' : 'Write description for this subblock...'}
                              rows={2}
                            />

                            {/* Subblock Items list */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {(sub.items || []).map((item) => (
                                <div key={item.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: 'var(--bg-secondary)', padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                  {item.image_url && (
                                    <img
                                      src={item.image_url}
                                      alt={item.title}
                                      onClick={() => setZoomedImage(item.image_url)}
                                      style={{ width: '24px', height: '36px', objectFit: 'cover', borderRadius: '3px', cursor: 'zoom-in' }}
                                    />
                                  )}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <h6 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</h6>
                                  </div>
                                  <button onClick={() => removeMediaItem(element.id, item.id, sub.id)} className="btn-secondary" style={{ padding: '0.2rem 0.4rem', border: 'none', background: 'transparent', color: '#ef4444' }}>
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}

                              <button type="button" onClick={() => openSearchModal(element.id, sub.id)} className="btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.5rem' }}>
                                <SearchIcon size={12} /> {language === 'es' ? 'Buscar y Añadir Obra' : 'Search & Add Item'}
                              </button>
                            </div>

                          </div>
                        ))}

                        {/* Add subblock trigger button */}
                        <button type="button" onClick={() => addSubblock(element.id)} className="btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', borderStyle: 'dashed', marginTop: '0.5rem' }}>
                          <PlusCircle size={14} /> {language === 'es' ? 'Crear Subbloque' : 'Create Subblock'}
                        </button>

                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            )}

          </div>

        </div>
      )}

      {/* Real-time search Modal overlay */}
      {searchTarget && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }}>
          <div className="glass-card" style={{ width: '500px', maxHeight: '80vh', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ margin: 0 }}>{language === 'es' ? 'Añadir Obra' : 'Add Item'}</h3>

            {modalSuccessMsg && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.5rem', borderRadius: '6px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600 }}>
                {modalSuccessMsg}
              </div>
            )}
            
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setSearchTab('search')}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: searchTab === 'search' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  color: searchTab === 'search' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {language === 'es' ? 'Buscar' : 'Search'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchTab('manual');
                  if (!manualTitle && searchQuery) {
                    setManualTitle(searchQuery);
                  }
                }}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: searchTab === 'manual' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  color: searchTab === 'manual' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {language === 'es' ? 'Añadir Manualmente' : 'Add Manually'}
              </button>
            </div>

            {searchTab === 'search' ? (
              <>
                <form onSubmit={triggerSearch} style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="text"
                      required
                      className="input-field"
                      placeholder={language === 'es' ? 'Ej. Batman, Star Wars...' : 'e.g. Batman, Star Wars...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ paddingLeft: '2.25rem' }}
                    />
                    <SearchIcon size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                  </div>
                  <button type="submit" disabled={isSearching} className="btn-primary" style={{ padding: '0 1rem' }}>
                    {isSearching ? '...' : t('searchButton')}
                  </button>
                </form>

                {/* Category Tabs */}
                {searchResults.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.4rem',
                    borderBottom: '1px solid var(--border-color)',
                    marginBottom: '0.5rem',
                    paddingBottom: '0.5rem'
                  }}>
                    {[
                      { value: 'all', label: language === 'es' ? 'Todo' : 'All' },
                      { value: 'movie', label: language === 'es' ? 'Películas' : 'Movies' },
                      { value: 'series', label: language === 'es' ? 'Series' : 'Series' },
                      { value: 'book', label: language === 'es' ? 'Libros' : 'Books' },
                      { value: 'game', label: language === 'es' ? 'Juegos' : 'Games' }
                    ].map(tab => (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => setActiveSearchTab(tab.value as any)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '15px',
                          border: '1px solid',
                          borderColor: activeSearchTab === tab.value ? 'var(--accent-primary)' : 'var(--border-color)',
                          background: activeSearchTab === tab.value ? 'var(--accent-primary)' : 'transparent',
                          color: activeSearchTab === tab.value ? '#ffffff' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          fontWeight: 500,
                          fontSize: '0.75rem',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem', minHeight: '200px' }}>
                  {searchResults.length === 0 && !isSearching && (
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: '2rem 0' }}>
                      {language === 'es' ? 'Escribe y busca para ver resultados.' : 'Type and search to display results.'}
                    </p>
                  )}
                  {(() => {
                    const filtered = activeSearchTab === 'all'
                      ? searchResults
                      : searchResults.filter(item => {
                          if (activeSearchTab === 'series') return item.item_type === 'series' || item.item_type === 'anime';
                          if (activeSearchTab === 'movie') return item.item_type === 'movie';
                          if (activeSearchTab === 'book') return item.item_type === 'book' || item.item_type === 'comic' || item.item_type === 'manga';
                          if (activeSearchTab === 'game') return item.item_type === 'game';
                          return true;
                        });
                    
                    if (filtered.length === 0 && searchResults.length > 0) {
                      return (
                        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: '2rem 0', fontSize: '0.85rem' }}>
                          {language === 'es' ? 'No se encontraron elementos en esta categoría.' : 'No items found in this category.'}
                        </p>
                      );
                    }
                    
                    return filtered.map((media) => {
                      const isExpanded = expandedMediaId === media.external_id;
                    return (
                      <div
                        key={media.external_id}
                        style={{
                          display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem',
                          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                          borderRadius: '8px', transition: 'all 0.2s', textAlign: 'left', position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                          <img
                            src={media.image_url}
                            alt={media.title}
                            onClick={() => setZoomedImage(media.image_url)}
                            style={{ width: '45px', height: '65px', objectFit: 'cover', borderRadius: '4px', cursor: 'zoom-in' }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h5 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{media.title}</h5>
                            <span style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', textTransform: 'capitalize', fontWeight: 600 }}>{t('media' + media.item_type.charAt(0).toUpperCase() + media.item_type.slice(1))}</span>
                            
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                              <button
                                type="button"
                                onClick={() => setExpandedMediaId(isExpanded ? null : media.external_id)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '0.75rem', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                              >
                                {isExpanded ? (language === 'es' ? 'Ocultar info' : 'Hide info') : (language === 'es' ? 'Ver info' : 'View info')}
                              </button>
                              
                              {media.item_type === 'series' && (
                                <button
                                  type="button"
                                  onClick={() => handleLoadSeriesEpisodes(media.external_id)}
                                  style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '0.75rem', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                                >
                                  {expandedSeriesId === media.external_id 
                                    ? (language === 'es' ? 'Ocultar capítulos' : 'Hide episodes') 
                                    : (language === 'es' ? 'Ver capítulos' : 'View episodes')
                                  }
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {(() => {
                            const isAlreadyAdded = media.external_id && addedIds.includes(media.external_id);
                            return (
                              <button
                                type="button"
                                onClick={() => handleSelectMediaItem(media)}
                                className="btn-primary"
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  fontSize: '0.75rem',
                                  borderRadius: '6px',
                                  background: isAlreadyAdded ? 'rgba(16, 185, 129, 0.15)' : 'var(--accent-primary)',
                                  color: isAlreadyAdded ? '#10b981' : '#ffffff',
                                  border: isAlreadyAdded ? '1px solid #10b981' : 'none'
                                }}
                              >
                                {isAlreadyAdded ? (language === 'es' ? 'Añadido' : 'Added') : (language === 'es' ? 'Añadir' : 'Add')}
                              </button>
                            );
                          })()}
                        </div>
                        
                        {isExpanded && media.description && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', padding: '0.5rem', background: 'var(--bg-primary)', borderRadius: '4px', maxHeight: '120px', overflowY: 'auto', borderLeft: '2px solid var(--accent-primary)', lineHeight: 1.4 }}>
                            {stripHtml(media.description)}
                          </div>
                        )}

                        {expandedSeriesId === media.external_id && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '180px', overflowY: 'auto', background: 'var(--bg-primary)', padding: '0.5rem', borderRadius: '6px' }}>
                            {isLoadingEpisodes ? (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                {language === 'es' ? 'Cargando capítulos...' : 'Loading episodes...'}
                              </div>
                            ) : expandedEpisodes.length === 0 ? (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                                {language === 'es' ? 'No se encontraron capítulos.' : 'No episodes found.'}
                              </div>
                            ) : (
                              expandedEpisodes.map((ep) => {
                                const ep_num = ep.episode_number;
                                const ep_name = ep.name || "Untitled Episode";
                                const fullTitle = `${media.title} - S01E${ep_num < 10 ? '0' + ep_num : ep_num} - ${ep_name}`;
                                const still = ep.still_path;
                                const image_url = still ? `https://image.tmdb.org/t/p/w185${still}` : media.image_url;
                                return (
                                  <div key={ep.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.25rem' }}>
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {ep_num}. {ep_name}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleSelectMediaItem({
                                        item_type: 'series',
                                        external_id: `tmdb-ep-${ep.id}`,
                                        title: fullTitle,
                                        image_url: image_url,
                                        description: ep.overview
                                      })}
                                      className="btn-primary"
                                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.7rem', borderRadius: '4px' }}
                                    >
                                      {language === 'es' ? 'Añadir' : 'Add'}
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                    });
                  })()}
                </div>
              </>
            ) : (
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!manualTitle.trim()) return;
                handleSelectMediaItem({
                  item_type: manualType,
                  external_id: `manual-${Date.now()}`,
                  title: manualTitle.trim(),
                  image_url: '',
                  description: ''
                });
              }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '200px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'left' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>{language === 'es' ? 'Título de la Obra' : 'Title'}</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder={language === 'es' ? 'Ej. Justice League of America #9' : 'e.g. Justice League of America #9'}
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', textAlign: 'left' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>{language === 'es' ? 'Formato' : 'Format'}</label>
                  <select
                    className="input-field"
                    value={manualType}
                    onChange={(e) => setManualType(e.target.value)}
                  >
                    <option value="comic">{t('mediaComic')}</option>
                    <option value="manga">{t('mediaManga')}</option>
                    <option value="book">{t('mediaBook')}</option>
                    <option value="game">{t('mediaGame')}</option>
                    <option value="movie">{t('mediaMovie')}</option>
                    <option value="series">{t('mediaSeries')}</option>
                  </select>
                </div>
                <button type="submit" className="btn-primary" style={{ marginTop: 'auto' }}>
                  {language === 'es' ? 'Añadir al Canvas' : 'Add to Canvas'}
                </button>
              </form>
            )}

            <button type="button" className="btn-secondary" onClick={() => setSearchTarget(null)} style={{ alignSelf: 'flex-end', marginTop: '0.5rem' }}>
              {language === 'es' ? 'Cerrar' : 'Close'}
            </button>
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
export default CreateGuide;
