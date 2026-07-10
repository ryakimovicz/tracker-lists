import React, { useState, useEffect } from 'react';
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
  return html.replace(/<[^>]*>/g, '');
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
  const [searchType, setSearchType] = useState('comic');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parseError = (err: any) => {
    const detail = err.response?.data?.detail;
    if (Array.isArray(detail)) {
      return detail.map(d => `${d.loc.join('.')}: ${d.msg}`).join(', ');
    }
    return detail || err.message || 'An error occurred';
  };

  // Load document flow if it exists on the guide
  useEffect(() => {
    if (guide) {
      const savedStructure = guide.section_descriptions;
      if (savedStructure && Array.isArray(savedStructure.flow)) {
        setDocFlow(savedStructure.flow);
      } else {
        setDocFlow([]);
      }
    }
  }, [guide]);

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
        visibility,
        importance_labels: importanceLabels,
        section_descriptions: { flow: [] } // Initialize with empty document flow wrapped in a dictionary
      });
      setGuide(response.data);
      setSuccessMsg(language === 'es' ? '¡Lista/Guía creada con éxito!' : 'List/Guide created successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(parseError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveDocumentFlow = async () => {
    if (!guide) return;
    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await apiClient.put(`/lists/${guide.id}`, {
        section_descriptions: { flow: docFlow } // Save wrapped document flow list in a dict
      });
      setGuide(response.data);
      setSuccessMsg(language === 'es' ? '¡Cambios guardados con éxito!' : 'Document changes saved successfully!');
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
      title: language === 'es' ? 'NUEVA SECCIÓN / ETAPA' : 'NEW SECTION / STAGE',
      description: language === 'es' ? 'Describe los objetivos o contexto de esta etapa...' : 'Describe the objectives or context of this stage...'
    };
    setDocFlow(prev => [...prev, newSec]);
  };

  const addBlock = () => {
    const newBlk: DocElement = {
      id: `blk-${Date.now()}`,
      type: 'block',
      title: language === 'es' ? 'Nuevo Bloque de Lectura' : 'New Reading Block',
      description: language === 'es' ? 'Notas o sinopsis del bloque...' : 'Notes or synopsis of this block...',
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
          title: language === 'es' ? 'Nuevo Subbloque' : 'New Subblock',
          description: language === 'es' ? 'Detalles de este subgrupo...' : 'Details of this subgroup...',
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
  };

  const triggerSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setErrorMsg('');
    try {
      const response = await apiClient.get('/search/', {
        params: { q: searchQuery, type: searchType }
      });
      setSearchResults(response.data);
    } catch (err: any) {
      setErrorMsg(language === 'es' ? 'Error al buscar en la API.' : 'Search failed.');
    } finally {
      setIsSearching(false);
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

      setSuccessMsg(language === 'es' ? `¡${media.title} añadido!` : `${media.title} added!`);
      setSearchTarget(null);
      setTimeout(() => setSuccessMsg(''), 3000);
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
          <h2>{language === 'es' ? 'Crear Nueva Lista/Guía' : 'Create New List/Guide'}</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{language === 'es' ? 'Título de la Lista/Guía' : 'List/Guide Title'}</label>
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
              placeholder={language === 'es' ? 'De qué se trata esta lista o guía...' : 'What this list or guide is about...'}
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
            {language === 'es' ? 'Crear Lista/Guía' : 'Create List/Guide'} <ArrowRight size={18} />
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
            
            <button onClick={handleSaveDocumentFlow} disabled={isSubmitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.5rem' }}>
              <Save size={16} /> {isSubmitting ? '...' : language === 'es' ? 'Guardar Cambios' : 'Save Changes'}
            </button>
          </div>

          {/* Document Canvas Container */}
          <div className="glass-card" style={{ padding: '3rem', minHeight: '600px', display: 'flex', flexDirection: 'column', gap: '2.5rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
            
            {/* Title Block */}
            <div style={{ borderBottom: '2px solid var(--border-color)', paddingBottom: '1.5rem', textAlign: 'left' }}>
              <h1 style={{ fontSize: '2.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>{guide.title}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', margin: 0, fontStyle: 'italic' }}>{guide.description}</p>
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
                          placeholder="TITULO DE LA SECCIÓN / ETAPA"
                        />

                        {/* Description Input */}
                        <textarea
                          value={element.description}
                          onChange={(e) => updateDocElement(element.id, { description: e.target.value })}
                          style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', borderBottom: '1px dashed transparent', outline: 'none', width: '100%', resize: 'none', fontStyle: 'italic', lineHeight: 1.5 }}
                          placeholder="Escribe la descripción o introducción de esta sección..."
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
                            placeholder="Título del Bloque"
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
                          placeholder="Descripción o comentarios de este bloque de lectura..."
                          rows={2}
                        />

                        {/* List of Media items in Block */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          {(element.items || []).map((item) => (
                            <div key={item.id} style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                              {item.image_url && (
                                <img src={item.image_url} alt={item.title} style={{ width: '32px', height: '48px', objectFit: 'cover', borderRadius: '4px' }} />
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
                            <SearchIcon size={14} /> {language === 'es' ? 'Añadir Obra (Buscar API)' : 'Add Media (Search API)'}
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
                                placeholder="Título del Subbloque"
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
                              placeholder="Notas del subbloque..."
                              rows={2}
                            />

                            {/* Subblock Items list */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              {(sub.items || []).map((item) => (
                                <div key={item.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: 'var(--bg-secondary)', padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                  {item.image_url && (
                                    <img src={item.image_url} alt={item.title} style={{ width: '24px', height: '36px', objectFit: 'cover', borderRadius: '3px' }} />
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
                                <SearchIcon size={12} /> {language === 'es' ? 'Añadir Obra' : 'Add Media'}
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
            <h3 style={{ margin: 0 }}>{language === 'es' ? 'Buscar Obra en APIs' : 'Search Media in APIs'}</h3>
            
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
              <select
                className="input-field"
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                style={{ width: '110px' }}
              >
                <option value="comic">{t('mediaComic')}</option>
                <option value="manga">{t('mediaManga')}</option>
                <option value="book">{t('mediaBook')}</option>
                <option value="game">{t('mediaGame')}</option>
                <option value="movie">{t('mediaMovie')}</option>
                <option value="series">{t('mediaSeries')}</option>
              </select>
              <button type="submit" disabled={isSearching} className="btn-primary" style={{ padding: '0 1rem' }}>
                {isSearching ? '...' : t('searchButton')}
              </button>
            </form>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
              {searchResults.length === 0 && !isSearching && (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', margin: '2rem 0' }}>
                  {language === 'es' ? 'Escribe y busca para ver resultados.' : 'Type and search to display results.'}
                </p>
              )}
              {searchResults.map((media) => (
                <div
                  key={media.external_id}
                  onClick={() => handleSelectMediaItem(media)}
                  style={{
                    display: 'flex', gap: '1rem', alignItems: 'center', padding: '0.5rem',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <img src={media.image_url} alt={media.title} style={{ width: '40px', height: '55px', objectFit: 'cover', borderRadius: '4px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{media.title}</h5>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stripHtml(media.description)}</p>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="btn-secondary" onClick={() => setSearchTarget(null)} style={{ alignSelf: 'flex-end' }}>
              {language === 'es' ? 'Cerrar' : 'Close'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
export default CreateGuide;
