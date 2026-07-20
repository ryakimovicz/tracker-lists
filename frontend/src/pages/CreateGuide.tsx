import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import { SearchPanel } from '../components/SearchPanel';
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
  ChevronUp,
  Lock,
  Plus,
  Scissors,
  ClipboardPaste
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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

interface ClipboardState {
  action: 'cut';
  type: 'section' | 'block' | 'subblock' | 'item';
  items: Array<{
    data: any;
    sourceId: string | number;
    sourceParentId?: string;
    sourceGrandparentId?: string;
  }>;
}

interface SelectedElementsState {
  parentId: string | null; // null if selecting root sections
  type: 'section' | 'block' | 'subblock' | 'item' | null;
  ids: (string | number)[];
}

const PasteZone = ({ 
  targetId, 
  index, 
  label, 
  actionTargetType,
  canPaste,
  handlePaste
}: { 
  type: 'section' | 'block' | 'subblock' | 'item', 
  targetId?: string, 
  index?: number, 
  label: string, 
  actionTargetType: 'root' | 'section' | 'block' | 'subblock',
  canPaste: boolean,
  handlePaste: (targetType: 'root' | 'section' | 'block' | 'subblock', targetId?: string, insertIndex?: number) => void
}) => {
  const [isHovered, setIsHovered] = useState(false);

  if (!canPaste) return null;

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => handlePaste(actionTargetType, targetId, index)}
      style={{
        height: isHovered ? '32px' : '12px',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        background: isHovered ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
        borderRadius: '6px',
        margin: '0.2rem 0',
        border: isHovered ? '1px dashed var(--accent-primary)' : '1px solid transparent'
      }}
    >
      {isHovered && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><ClipboardPaste size={14} /> {label}</span>}
    </div>
  );
};

export const CreateGuide: React.FC = () => {
  const { t, language } = useTranslation();
  const { user: currentUser } = useAuth();

  // Step 1: Create Guide state
  const [guide, setGuide] = useState<CreatedGuide | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  // Step 2: Word-style Document Flow Editor state
  const [docFlow, setDocFlow] = useState<DocElement[]>([]);

  // Real-time search modal states (inside editor)
  const [searchTarget, setSearchTarget] = useState<{ elementId: string; subblockId?: string } | null>(null);
  const [searchPanels, setSearchPanels] = useState<string[]>(['initial']); // array of panel IDs

  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
  const [selectedElements, setSelectedElements] = useState<SelectedElementsState>({ parentId: null, type: null, ids: [] });

  const [modalSuccessMsg, setModalSuccessMsg] = useState('');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

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
      const response = await apiClient.post('/lists/', {
        title,
        description,
        visibility, // Enforced as draft in backend, which saves this value in intended_visibility
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

  const regenerateIds = (element: DocElement): DocElement => {
    const newId = `${element.type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newElement = { ...element, id: newId };
    if (newElement.subblocks) {
      newElement.subblocks = newElement.subblocks.map(regenerateIds);
    }
    return newElement;
  };

  const toggleSelection = (type: 'section' | 'block' | 'subblock' | 'item', id: string | number, parentId: string | null = null) => {
    setSelectedElements(prev => {
      // If something is already selected and this is a different type or parent, ignore the click (it should be disabled in UI)
      if (prev.ids.length > 0 && (prev.type !== type || prev.parentId !== parentId)) {
        return prev;
      }
      if (prev.type !== type || prev.parentId !== parentId) {
        return { type, parentId, ids: [id] };
      }
      if (prev.ids.includes(id as never)) {
        const nextIds = prev.ids.filter(i => i !== id);
        if (nextIds.length === 0) return { parentId: null, type: null, ids: [] };
        return { ...prev, ids: nextIds };
      }
      return { ...prev, ids: [...prev.ids, id] };
    });
  };

  const handleDeleteMulti = () => {
    if (selectedElements.ids.length === 0 || !selectedElements.type) return;

    setDocFlow(prev => {
      let newFlow = JSON.parse(JSON.stringify(prev)) as DocElement[];
      
      selectedElements.ids.forEach(selId => {
        if (selectedElements.type === 'item') {
          docFlow.forEach(el => {
            if (el.id === selectedElements.parentId && el.items) {
              const block = newFlow.find(b => b.id === el.id);
              if (block && block.items) {
                block.items = block.items.filter(i => i.id !== selId);
              }
            } else if (el.subblocks) {
              el.subblocks.forEach(sub => {
                if (sub.id === selectedElements.parentId && sub.items) {
                  const block = newFlow.find(b => b.id === el.id);
                  if (block && block.subblocks) {
                    const newSub = block.subblocks.find(s => s.id === sub.id);
                    if (newSub && newSub.items) {
                      newSub.items = newSub.items.filter(i => i.id !== selId);
                    }
                  }
                }
              });
            }
          });
        } else if (selectedElements.type === 'subblock') {
          const block = newFlow.find(el => el.id === selectedElements.parentId);
          if (block && block.subblocks) {
            block.subblocks = block.subblocks.filter(s => s.id !== selId);
          }
        } else {
          newFlow = newFlow.filter(el => el.id !== selId);
        }
      });
      return newFlow;
    });

    setSelectedElements({ parentId: null, type: null, ids: [] });
  };

  const handleCutMulti = () => {
    if (selectedElements.ids.length === 0 || !selectedElements.type) return;

    let itemsToCut: any[] = [];
    
    // We need to gather the data for each selected element
    selectedElements.ids.forEach(selId => {
      if (selectedElements.type === 'item') {
        docFlow.forEach(el => {
          if (el.id === selectedElements.parentId && el.items) {
            const item = el.items.find(i => i.id === selId);
            if (item) itemsToCut.push({ data: item, sourceId: item.id, sourceParentId: el.id });
          } else if (el.subblocks) {
            el.subblocks.forEach(sub => {
              if (sub.id === selectedElements.parentId && sub.items) {
                const item = sub.items.find(i => i.id === selId);
                if (item) itemsToCut.push({ data: item, sourceId: item.id, sourceParentId: el.id, sourceGrandparentId: sub.id });
              }
            });
          }
        });
      } else if (selectedElements.type === 'subblock') {
        docFlow.forEach(el => {
          if (el.id === selectedElements.parentId && el.subblocks) {
            const sub = el.subblocks.find(s => s.id === selId);
            if (sub) itemsToCut.push({ data: sub, sourceId: sub.id, sourceParentId: el.id });
          }
        });
      } else {
        const el = docFlow.find(e => e.id === selId);
        if (el) itemsToCut.push({ data: el, sourceId: el.id });
      }
    });

    setClipboard({
      action: 'cut',
      type: selectedElements.type,
      items: itemsToCut
    });
    setSelectedElements({ parentId: null, type: null, ids: [] });
  };

  const handleCut = (
    type: 'section' | 'block' | 'subblock' | 'item',
    data: any,
    sourceId: string | number,
    sourceParentId?: string,
    sourceGrandparentId?: string
  ) => {
    setClipboard({
      action: 'cut',
      type,
      items: [{ data, sourceId, sourceParentId, sourceGrandparentId }]
    });
  };

  const handlePaste = (targetType: 'root' | 'section' | 'block' | 'subblock', targetId?: string, insertIndex?: number) => {
    if (!clipboard) return;

    setDocFlow(prev => {
      let newFlow = JSON.parse(JSON.stringify(prev)) as DocElement[];

      // 1. Remove from source
      clipboard.items.forEach(clipboardItem => {
        if (clipboard.type === 'item') {
          if (clipboardItem.sourceGrandparentId) {
            const block = newFlow.find(el => el.id === clipboardItem.sourceParentId);
            if (block && block.subblocks) {
              const sub = block.subblocks.find(s => s.id === clipboardItem.sourceGrandparentId);
              if (sub && sub.items) {
                sub.items = sub.items.filter(item => item.id !== clipboardItem.sourceId);
              }
            }
          } else {
            const block = newFlow.find(el => el.id === clipboardItem.sourceParentId);
            if (block && block.items) {
              block.items = block.items.filter(item => item.id !== clipboardItem.sourceId);
            }
          }
        } else {
          if (clipboardItem.sourceParentId) {
            const block = newFlow.find(el => el.id === clipboardItem.sourceParentId);
            if (block && block.subblocks) {
              block.subblocks = block.subblocks.filter(s => s.id !== clipboardItem.sourceId);
            }
          } else {
            newFlow = newFlow.filter(el => el.id !== clipboardItem.sourceId);
          }
        }
      });

      // 2. Prepare data to paste
      const pasteDatas = clipboard.items.map(clipboardItem => {
        if (clipboard.type === 'item') {
          return { ...clipboardItem.data };
        } else {
          const pData = regenerateIds(clipboardItem.data);
          if (targetType === 'section' && clipboard.type === 'subblock') {
            pData.type = 'block';
          }
          return pData;
        }
      });

      // Helper to safely insert at index or push
      const insertOrPush = (arr: any[], dataArray: any[], idx?: number) => {
        if (idx !== undefined && idx >= 0 && idx <= arr.length) {
          arr.splice(idx, 0, ...dataArray);
        } else {
          arr.push(...dataArray);
        }
      };

      // 3. Insert into target
      if (targetType === 'root' && (clipboard.type === 'section' || clipboard.type === 'block')) {
        insertOrPush(newFlow, pasteDatas, insertIndex);
      } else if (targetType === 'section' && (clipboard.type === 'block' || clipboard.type === 'subblock')) {
        let insertPos = -1;
        if (insertIndex !== undefined) {
           // insertIndex here is relative to the blocks inside this section
           // but our newFlow is flat. So we need to find the correct absolute index.
           let sectionFound = false;
           let relativeIdx = 0;
           for (let i = 0; i < newFlow.length; i++) {
             if (newFlow[i].id === targetId) {
               sectionFound = true;
               if (insertIndex === 0) { insertPos = i + 1; break; }
             } else if (sectionFound) {
               if (newFlow[i].type === 'section') {
                 insertPos = i; break;
               }
               relativeIdx++;
               if (relativeIdx === insertIndex) {
                 insertPos = i + 1; break;
               }
             }
           }
           if (sectionFound && insertPos === -1) insertPos = newFlow.length;
        } else {
           // Just after the section header
           insertPos = newFlow.findIndex(el => el.id === targetId) + 1;
        }

        if (insertPos !== -1) {
          newFlow.splice(insertPos, 0, ...pasteDatas);
        }
      } else if (targetType === 'block' && clipboard.type === 'subblock') {
        const block = newFlow.find(el => el.id === targetId);
        if (block) {
          if (!block.subblocks) block.subblocks = [];
          insertOrPush(block.subblocks, pasteDatas, insertIndex);
        }
      } else if (targetType === 'block' && clipboard.type === 'item') {
        const block = newFlow.find(el => el.id === targetId);
        if (block) {
          if (!block.items) block.items = [];
          insertOrPush(block.items, pasteDatas, insertIndex);
        }
      } else if (targetType === 'subblock' && clipboard.type === 'item') {
        for (const block of newFlow) {
          if (block.type === 'block' && block.subblocks) {
            const sub = block.subblocks.find(s => s.id === targetId);
            if (sub) {
              if (!sub.items) sub.items = [];
              insertOrPush(sub.items, pasteDatas, insertIndex);
              break;
            }
          }
        }
      }

      return newFlow;
    });

    setClipboard(null);
  };

  // Media API search handlers
  const openSearchModal = (elementId: string, subblockId?: string) => {
    setSearchTarget({ elementId, subblockId });
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                className="input-field"
                value={visibility}
                onChange={(e: any) => setVisibility(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="public">{language === 'es' ? 'Pública' : 'Public'}</option>
                <option value="unlisted" disabled={!currentUser?.is_pro}>{language === 'es' ? 'No Listada (Pro)' : 'Unlisted (Pro)'}</option>
                <option value="private" disabled={!currentUser?.is_pro}>{language === 'es' ? 'Privada (Pro)' : 'Private (Pro)'}</option>
              </select>
            </div>
            {!currentUser?.is_pro && (
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Lock size={12} /> {language === 'es' ? 'Hazte Pro para guías ocultas.' : 'Go Pro for hidden guides.'}
              </p>
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
              {clipboard && clipboard.type === 'section' && (
                <button onClick={() => handlePaste('root')} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                  <ClipboardPaste size={16} /> {language === 'es' ? 'Pegar Sección' : 'Paste Section'}
                </button>
              )}
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
                  const rootPasteZone = (
                    <PasteZone 
                      type={element.type === 'section' ? 'section' : 'block'} 
                      actionTargetType="root" 
                      index={index} 
                      label={language === 'es' ? 'Pegar Aquí' : 'Paste Here'} 
                      canPaste={clipboard?.type === 'section' || clipboard?.type === 'block'} 
                      handlePaste={handlePaste} 
                    />
                  );
                  
                  // SECTION ELEMENT RENDER
                  if (element.type === 'section') {
                    return (
                      <React.Fragment key={element.id}>
                        {rootPasteZone}
                        <div className="document-section-block" style={{ padding: '1.5rem', background: 'rgba(124,58,237,0.03)', borderLeft: '4px solid var(--accent-primary)', position: 'relative', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderRadius: '0 8px 8px 0' }}>
                        
                        {/* Control actions */}
                        <div style={{ position: 'absolute', top: '1rem', left: '1rem' }}>
                          <input type="checkbox" disabled={selectedElements.ids.length > 0 && (selectedElements.type !== 'section' || selectedElements.parentId !== null)} checked={selectedElements.type === 'section' && selectedElements.ids.includes(element.id)} onChange={() => toggleSelection('section', element.id)} style={{ transform: 'scale(1.2)', cursor: 'pointer' }} />
                        </div>
                        <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.35rem' }}>
                          {clipboard && (clipboard.type === 'block' || clipboard.type === 'subblock') && (
                            <button onClick={() => handlePaste('section', element.id)} className="btn-primary" style={{ padding: '0.2rem 0.4rem', marginRight: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <ClipboardPaste size={14} /> {language === 'es' ? 'Pegar' : 'Paste'}
                            </button>
                          )}
                          <button onClick={() => handleCut('section', element, element.id)} className="btn-secondary" style={{ padding: '0.2rem 0.4rem', color: '#f59e0b' }}><Scissors size={14} /></button>
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
                      </React.Fragment>
                    );
                  }

                  // BLOCK ELEMENT RENDER
                  if (element.type === 'block') {
                    return (
                      <React.Fragment key={element.id}>
                        {rootPasteZone}
                      <div style={{ padding: '2rem', border: '1px solid var(--border-color)', borderRadius: '12px', background: 'var(--bg-primary)', position: 'relative', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        
                        {/* Control actions */}
                        <div style={{ position: 'absolute', top: '1rem', left: '1rem' }}>
                          <input type="checkbox" disabled={selectedElements.ids.length > 0 && (selectedElements.type !== 'block' || selectedElements.parentId !== null)} checked={selectedElements.type === 'block' && selectedElements.ids.includes(element.id)} onChange={() => toggleSelection('block', element.id)} style={{ transform: 'scale(1.2)', cursor: 'pointer' }} />
                        </div>
                        <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.35rem' }}>
                          {clipboard && (clipboard.type === 'subblock' || clipboard.type === 'item') && (
                            <button onClick={() => handlePaste('block', element.id)} className="btn-primary" style={{ padding: '0.2rem 0.4rem', marginRight: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              <ClipboardPaste size={14} /> {language === 'es' ? 'Pegar' : 'Paste'}
                            </button>
                          )}
                          <button onClick={() => handleCut('block', element, element.id)} className="btn-secondary" style={{ padding: '0.2rem 0.4rem', color: '#f59e0b' }}><Scissors size={14} /></button>
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
                              <option value="">{language === 'es' ? 'Sin importancia' : 'No importance'}</option>
                              <option value="1">1 - {language === 'es' ? 'Extra' : 'Extra'}</option>
                              <option value="2">2 - {language === 'es' ? 'Opcional' : 'Optional'}</option>
                              <option value="3">3 - {language === 'es' ? 'Recomendado' : 'Recommended'}</option>
                              <option value="4">4 - {language === 'es' ? 'Importante' : 'Important'}</option>
                              <option value="5">5 - {language === 'es' ? 'Obligatorio' : 'Mandatory'}</option>
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
                          {(element.items || []).map((item, itemIndex) => (
                            <React.Fragment key={item.id}>
                              <PasteZone 
                                type="item" 
                                actionTargetType="block" 
                                targetId={element.id} 
                                index={itemIndex} 
                                label={language === 'es' ? 'Pegar Aquí' : 'Paste Here'} 
                                canPaste={clipboard?.type === 'item'} 
                                handlePaste={handlePaste} 
                              />
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', background: 'var(--bg-secondary)', padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                              <input type="checkbox" disabled={selectedElements.ids.length > 0 && (selectedElements.type !== 'item' || selectedElements.parentId !== element.id)} checked={selectedElements.type === 'item' && selectedElements.ids.includes(item.id)} onChange={() => toggleSelection('item', item.id, element.id)} style={{ transform: 'scale(1.1)', cursor: 'pointer' }} />
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
                              <div style={{ display: 'flex', gap: '0.35rem' }}>
                                <button onClick={() => handleCut('item', item, item.id, element.id)} className="btn-secondary" style={{ padding: '0.2rem 0.4rem', border: 'none', background: 'transparent', color: '#f59e0b' }}>
                                  <Scissors size={16} />
                                </button>
                                <button onClick={() => removeMediaItem(element.id, item.id)} className="btn-secondary" style={{ padding: '0.2rem 0.4rem', border: 'none', background: 'transparent', color: '#ef4444' }}>
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                            </React.Fragment>
                          ))}
                          <PasteZone 
                            type="item" 
                            actionTargetType="block" 
                            targetId={element.id} 
                            index={(element.items || []).length} 
                            label={language === 'es' ? 'Pegar Aquí' : 'Paste Here'} 
                            canPaste={clipboard?.type === 'item'} 
                            handlePaste={handlePaste} 
                          />

                          <button type="button" onClick={() => openSearchModal(element.id)} className="btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', marginTop: '0.25rem' }}>
                            <SearchIcon size={14} /> {language === 'es' ? 'Buscar y Añadir Obra' : 'Search & Add Item'}
                          </button>
                        </div>

                        {/* Nested Subblocks */}
                        {(element.subblocks || []).map((sub, subIndex) => (
                          <React.Fragment key={sub.id}>
                            <PasteZone 
                              type="subblock" 
                              actionTargetType="block" 
                              targetId={element.id} 
                              index={subIndex} 
                              label={language === 'es' ? 'Pegar Aquí' : 'Paste Here'} 
                              canPaste={clipboard?.type === 'subblock'} 
                              handlePaste={handlePaste} 
                            />
                          <div style={{ marginLeft: '2rem', padding: '1.25rem', borderLeft: '2px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
                            <div style={{ position: 'absolute', top: '1.25rem', left: '0.5rem' }}>
                              <input type="checkbox" disabled={selectedElements.ids.length > 0 && (selectedElements.type !== 'subblock' || selectedElements.parentId !== element.id)} checked={selectedElements.type === 'subblock' && selectedElements.ids.includes(sub.id)} onChange={() => toggleSelection('subblock', sub.id, element.id)} style={{ transform: 'scale(1.1)', cursor: 'pointer' }} />
                            </div>
                            <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', display: 'flex', gap: '0.35rem' }}>
                              {clipboard && clipboard.type === 'item' && (
                                <button onClick={() => handlePaste('subblock', sub.id)} className="btn-primary" style={{ padding: '0.2rem 0.4rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <ClipboardPaste size={14} /> {language === 'es' ? 'Pegar' : 'Paste'}
                                </button>
                              )}
                              <button onClick={() => handleCut('subblock', sub, sub.id, element.id)} className="btn-secondary" style={{ padding: '0.2rem 0.4rem', color: '#f59e0b', border: 'none', background: 'transparent' }}><Scissors size={14} /></button>
                              <button onClick={() => removeDocElement(element.id, sub.id)} className="btn-secondary" style={{ padding: '0.2rem 0.4rem', color: '#ef4444', border: 'none', background: 'transparent' }}><Trash2 size={14} /></button>
                            </div>

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
                                  <option value="">--</option>
                                  <option value="1">1 - {language === 'es' ? 'Extra' : 'Extra'}</option>
                                  <option value="2">2 - {language === 'es' ? 'Opcional' : 'Optional'}</option>
                                  <option value="3">3 - {language === 'es' ? 'Recomendado' : 'Recommended'}</option>
                                  <option value="4">4 - {language === 'es' ? 'Importante' : 'Important'}</option>
                                  <option value="5">5 - {language === 'es' ? 'Obligatorio' : 'Mandatory'}</option>
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
                              {(sub.items || []).map((item, itemIndex) => (
                                <React.Fragment key={item.id}>
                                  <PasteZone 
                                    type="item" 
                                    actionTargetType="subblock" 
                                    targetId={sub.id} 
                                    index={itemIndex} 
                                    label={language === 'es' ? 'Pegar Aquí' : 'Paste Here'} 
                                    canPaste={clipboard?.type === 'item'} 
                                    handlePaste={handlePaste} 
                                  />
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: 'var(--bg-secondary)', padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                                  <input type="checkbox" disabled={selectedElements.ids.length > 0 && (selectedElements.type !== 'item' || selectedElements.parentId !== sub.id)} checked={selectedElements.type === 'item' && selectedElements.ids.includes(item.id)} onChange={() => toggleSelection('item', item.id, sub.id)} style={{ transform: 'scale(1.1)', cursor: 'pointer' }} />
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
                                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                                    <button onClick={() => handleCut('item', item, item.id, element.id, sub.id)} className="btn-secondary" style={{ padding: '0.2rem 0.4rem', border: 'none', background: 'transparent', color: '#f59e0b' }}>
                                      <Scissors size={14} />
                                    </button>
                                    <button onClick={() => removeMediaItem(element.id, item.id, sub.id)} className="btn-secondary" style={{ padding: '0.2rem 0.4rem', border: 'none', background: 'transparent', color: '#ef4444' }}>
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                                </React.Fragment>
                              ))}
                              <PasteZone 
                                type="item" 
                                actionTargetType="subblock" 
                                targetId={sub.id} 
                                index={(sub.items || []).length} 
                                label={language === 'es' ? 'Pegar Aquí' : 'Paste Here'} 
                                canPaste={clipboard?.type === 'item'} 
                                handlePaste={handlePaste} 
                              />

                              <button type="button" onClick={() => openSearchModal(element.id, sub.id)} className="btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.5rem' }}>
                                <SearchIcon size={12} /> {language === 'es' ? 'Buscar y Añadir Obra' : 'Search & Add Item'}
                              </button>
                            </div>

                          </div>
                          </React.Fragment>
                        ))}
                        <PasteZone 
                          type="subblock" 
                          actionTargetType="block" 
                          targetId={element.id} 
                          index={(element.subblocks || []).length} 
                          label={language === 'es' ? 'Pegar Aquí' : 'Paste Here'} 
                          canPaste={clipboard?.type === 'subblock'} 
                          handlePaste={handlePaste} 
                        />

                        {/* Add subblock trigger button */}
                        <button type="button" onClick={() => addSubblock(element.id)} className="btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.35rem 0.75rem', borderStyle: 'dashed', marginTop: '0.5rem' }}>
                          <PlusCircle size={14} /> {language === 'es' ? 'Crear Subbloque' : 'Create Subblock'}
                        </button>

                        </div>
                        </React.Fragment>
                      );
                    }

                    return null;
                  })}
                  <PasteZone 
                    type="section" 
                    actionTargetType="root" 
                    index={docFlow.length} 
                    label={language === 'es' ? 'Pegar Aquí' : 'Paste Here'} 
                    canPaste={clipboard?.type === 'section' || clipboard?.type === 'block'} 
                    handlePaste={handlePaste} 
                  />
                </div>
              )}

          </div>

        </div>
      )}

      {/* Floating Action Bar for Multi-Selection */}
      {selectedElements.ids.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: '24px',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          zIndex: 1000
        }}>
          <span style={{ fontWeight: 600 }}>{selectedElements.ids.length} {language === 'es' ? 'seleccionados' : 'selected'}</span>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={handleCutMulti} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 1rem' }}>
              <Scissors size={16} /> {language === 'es' ? 'Cortar' : 'Cut'}
            </button>
            <button onClick={handleDeleteMulti} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 1rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
              <Trash2 size={16} /> {language === 'es' ? 'Eliminar' : 'Delete'}
            </button>
            <button onClick={() => setSelectedElements({ parentId: null, type: null, ids: [] })} className="btn-secondary" style={{ padding: '0.4rem 1rem' }}>
              {language === 'es' ? 'Cancelar' : 'Cancel'}
            </button>
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
          <div className="glass-card" style={{ width: '90vw', maxWidth: '1400px', maxHeight: '90vh', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{language === 'es' ? 'Añadir Obra' : 'Add Item'}</h3>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button 
                  type="button" 
                  onClick={() => {
                    if (searchPanels.length < 10) setSearchPanels([...searchPanels, `panel-${Date.now()}`]);
                  }}
                  disabled={searchPanels.length >= 10}
                  className="btn-primary" 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.8rem', opacity: searchPanels.length >= 10 ? 0.5 : 1 }}
                >
                  <Plus size={14} /> {language === 'es' ? 'Nueva Búsqueda' : 'New Search'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => { setSearchTarget(null); setSearchPanels(['initial']); }} style={{ padding: '0.4rem 0.8rem' }}>
                  {language === 'es' ? 'Cerrar' : 'Close'}
                </button>
              </div>
            </div>

            {modalSuccessMsg && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.5rem', borderRadius: '6px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600 }}>
                {modalSuccessMsg}
              </div>
            )}
            
            <div style={{
              display: 'flex',
              gap: '1rem',
              overflowX: 'auto',
              overflowY: 'auto',
              padding: '0.5rem 0',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              {searchPanels.map((panelId) => (
                <SearchPanel
                  key={panelId}
                  id={panelId}
                  onRemove={(id) => setSearchPanels(prev => prev.filter(p => p !== id))}
                  canRemove={searchPanels.length > 1}
                  language={language}
                  t={t}
                  addedIds={addedIds}
                  onSelectItem={handleSelectMediaItem}
                  setZoomedImage={setZoomedImage}
                />
              ))}
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
export default CreateGuide;
