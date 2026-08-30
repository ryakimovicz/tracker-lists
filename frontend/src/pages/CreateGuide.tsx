import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
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
  Lock,
  Plus,
  Scissors,
  ClipboardPaste,
  Copy,
  Menu,
  Eye,
  Crown,
  Sparkles,
  Compass
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ProModal } from '../components/ProModal';
import { AdBanner } from '../components/AdBanner';

// ============================================================================
// FEATURE FLAG: SECCIÓN EN DESARROLLO
// Cambiar a `false` cuando se desee habilitar "Crear Guía" para todos los usuarios.
// Si está en `true`, solo los administradores pueden acceder y crear guías.
// ============================================================================
export const IS_CREATE_GUIDE_IN_DEVELOPMENT = true;


interface CreatedGuide {
  id: number;
  title: string;
  description: string;
  visibility: string;
  can_edit?: boolean;
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
  action: 'cut' | 'copy';
  type: 'section' | 'block' | 'subblock' | 'item';
  items: Array<{
    data: any;
    sourceId: string | number;
    sourceIds?: (string | number)[];
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
  handlePaste,
  indent = false
}: { 
  type: 'section' | 'block' | 'subblock' | 'item', 
  targetId?: string, 
  index?: number, 
  label: string, 
  actionTargetType: 'root' | 'section' | 'block' | 'subblock',
  canPaste: boolean,
  handlePaste: (targetType: 'root' | 'section' | 'block' | 'subblock', targetId?: string, insertIndex?: number) => void,
  indent?: boolean
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
        width: indent ? 'calc(100% - 2.5rem)' : '100%',
        marginLeft: indent ? '2.5rem' : '0',
        boxSizing: 'border-box',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        background: isHovered ? 'rgba(124, 58, 237, 0.1)' : 'transparent',
        borderRadius: '6px',
        margin: indent ? '0.2rem 0 0.2rem 2.5rem' : '0.2rem 0',
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
  const [showProModal, setShowProModal] = useState(false);
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
  const navigate = useNavigate();
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
          importance_rank: el.importance_rank ?? 3,
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

  const updateItemImportance = (blockId: string, itemId: number, rank: number | null, subblockId?: string) => {
    setDocFlow(prev => prev.map(el => {
      if (subblockId) {
        if (el.id === blockId && el.type === 'block') {
          return {
            ...el,
            subblocks: (el.subblocks || []).map(sub => {
              if (sub.id === subblockId) {
                return {
                  ...sub,
                  items: (sub.items || []).map(item => {
                    if (item.id === itemId) {
                      return { ...item, importance_rank: rank };
                    }
                    return item;
                  })
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
            items: (el.items || []).map(item => {
              if (item.id === itemId) {
                return { ...item, importance_rank: rank };
              }
              return item;
            })
          };
        }
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

  const getSectionChunkElements = (flow: DocElement[], sectionId: string): DocElement[] => {
    const elements: DocElement[] = [];
    const idx = flow.findIndex(el => el.id === sectionId);
    if (idx === -1) return elements;
    elements.push(flow[idx]);
    for (let i = idx + 1; i < flow.length; i++) {
      if (flow[i].type === 'section') break;
      elements.push(flow[i]);
    }
    return elements;
  };

  const handleCopyMulti = () => {
    if (selectedElements.ids.length === 0 || !selectedElements.type) return;

    let itemsToCopy: any[] = [];
    const selSet = new Set(selectedElements.ids);
    
    if (selectedElements.type === 'item') {
      docFlow.forEach(el => {
        if (el.id === selectedElements.parentId && el.items) {
          el.items.forEach(item => {
            if (selSet.has(item.id)) {
              itemsToCopy.push({ data: JSON.parse(JSON.stringify(item)), sourceId: item.id });
            }
          });
        } else if (el.subblocks) {
          el.subblocks.forEach(sub => {
            if (sub.id === selectedElements.parentId && sub.items) {
              sub.items.forEach(item => {
                if (selSet.has(item.id)) {
                  itemsToCopy.push({ data: JSON.parse(JSON.stringify(item)), sourceId: item.id });
                }
              });
            }
          });
        }
      });
    } else if (selectedElements.type === 'subblock') {
      docFlow.forEach(el => {
        if (el.id === selectedElements.parentId && el.subblocks) {
          el.subblocks.forEach(sub => {
            if (selSet.has(sub.id)) {
              itemsToCopy.push({ data: JSON.parse(JSON.stringify(sub)), sourceId: sub.id });
            }
          });
        }
      });
    } else if (selectedElements.type === 'section') {
      docFlow.forEach(el => {
        if (selSet.has(el.id) && el.type === 'section') {
          const chunk = getSectionChunkElements(docFlow, el.id);
          itemsToCopy.push({ data: JSON.parse(JSON.stringify(chunk)), sourceId: el.id });
        }
      });
    } else if (selectedElements.type === 'block') {
      docFlow.forEach(el => {
        if (selSet.has(el.id)) {
          itemsToCopy.push({ data: JSON.parse(JSON.stringify(el)), sourceId: el.id });
        }
      });
    }

    setClipboard({
      action: 'copy',
      type: selectedElements.type,
      items: itemsToCopy
    });
    setSelectedElements({ parentId: null, type: null, ids: [] });
  };

  const handleCutMulti = () => {
    if (selectedElements.ids.length === 0 || !selectedElements.type) return;

    let itemsToCut: any[] = [];
    const selSet = new Set(selectedElements.ids);
    
    if (selectedElements.type === 'item') {
      docFlow.forEach(el => {
        if (el.id === selectedElements.parentId && el.items) {
          el.items.forEach(item => {
            if (selSet.has(item.id)) {
              itemsToCut.push({ data: item, sourceId: item.id, sourceParentId: el.id });
            }
          });
        } else if (el.subblocks) {
          el.subblocks.forEach(sub => {
            if (sub.id === selectedElements.parentId && sub.items) {
              sub.items.forEach(item => {
                if (selSet.has(item.id)) {
                  itemsToCut.push({ data: item, sourceId: item.id, sourceParentId: el.id, sourceGrandparentId: sub.id });
                }
              });
            }
          });
        }
      });
    } else if (selectedElements.type === 'subblock') {
      docFlow.forEach(el => {
        if (el.id === selectedElements.parentId && el.subblocks) {
          el.subblocks.forEach(sub => {
            if (selSet.has(sub.id)) {
              itemsToCut.push({ data: sub, sourceId: sub.id, sourceParentId: el.id });
            }
          });
        }
      });
    } else if (selectedElements.type === 'section') {
      docFlow.forEach(el => {
        if (selSet.has(el.id) && el.type === 'section') {
          const chunk = getSectionChunkElements(docFlow, el.id);
          itemsToCut.push({ data: chunk, sourceId: el.id, sourceIds: chunk.map(c => c.id) });
        }
      });
    } else if (selectedElements.type === 'block') {
      docFlow.forEach(el => {
        if (selSet.has(el.id)) {
          itemsToCut.push({ data: el, sourceId: el.id });
        }
      });
    }

    setClipboard({
      action: 'cut',
      type: selectedElements.type,
      items: itemsToCut
    });
    setSelectedElements({ parentId: null, type: null, ids: [] });
  };

  const [pointerDrag, setPointerDrag] = useState<{
    dragType: 'section' | 'block' | 'subblock' | 'item';
    item: any;
    sourceParentId: string;
    sourceGrandparentId?: string;
    sourceIndex: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ parentId: string; grandparentId?: string; index: number; targetSectionId?: string; isAfter?: boolean } | null>(null);

  const pointerDragRef = useRef<typeof pointerDrag>(null);
  const dragOverTargetRef = useRef<typeof dragOverTarget>(null);

  useEffect(() => {
    pointerDragRef.current = pointerDrag;
  }, [pointerDrag]);

  useEffect(() => {
    dragOverTargetRef.current = dragOverTarget;
  }, [dragOverTarget]);

  // Pointer-based Drag & Drop with full native mouse wheel support for sections, blocks, subblocks, and items
  useEffect(() => {
    if (!pointerDrag) return;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    const updateTarget = (clientX: number, clientY: number) => {
      const elements = document.elementsFromPoint(clientX, clientY);

      if (pointerDrag.dragType === 'section') {
        const secEl = elements.map(el => el.closest('[data-section-element-id]')).find(Boolean) as HTMLElement | undefined;
        if (secEl) {
          const secId = secEl.getAttribute('data-section-element-id') || '';
          const rect = secEl.getBoundingClientRect();
          const isAfter = clientY > rect.top + rect.height / 2;

          setDragOverTarget(prev => {
            if (prev && prev.parentId === 'section-root' && prev.targetSectionId === secId && prev.isAfter === isAfter) return prev;
            return { parentId: 'section-root', targetSectionId: secId, isAfter, index: 0 };
          });
        }
      } else if (pointerDrag.dragType === 'block') {
        const rootEl = elements.map(el => el.closest('[data-root-element-id]')).find(Boolean) as HTMLElement | undefined;
        if (rootEl) {
          const cIdx = parseInt(rootEl.getAttribute('data-root-index') || '0', 10);
          const rect = rootEl.getBoundingClientRect();
          const isAfter = clientY > rect.top + rect.height / 2;
          const targetIdx = isAfter ? cIdx + 1 : cIdx;

          setDragOverTarget(prev => {
            if (prev && prev.parentId === 'root' && prev.index === targetIdx) return prev;
            return { parentId: 'root', index: targetIdx };
          });
        }
      } else if (pointerDrag.dragType === 'subblock') {
        const subEl = elements.map(el => el.closest('[data-subblock-id]')).find(Boolean) as HTMLElement | undefined;
        if (subEl) {
          const pId = subEl.getAttribute('data-subblock-parent-id') || '';
          const cIdx = parseInt(subEl.getAttribute('data-subblock-index') || '0', 10);
          const rect = subEl.getBoundingClientRect();
          const isAfter = clientY > rect.top + rect.height / 2;
          const targetIdx = isAfter ? cIdx + 1 : cIdx;

          setDragOverTarget(prev => {
            if (prev && prev.parentId === pId && prev.grandparentId === 'subblock-container' && prev.index === targetIdx) return prev;
            return { parentId: pId, grandparentId: 'subblock-container', index: targetIdx };
          });
        }
      } else {
        const cardEl = elements.map(el => el.closest('[data-card-item-id]')).find(Boolean) as HTMLElement | undefined;
        if (cardEl) {
          const pId = cardEl.getAttribute('data-card-parent-id') || '';
          const gpId = cardEl.getAttribute('data-card-grandparent-id') || undefined;
          const cIdx = parseInt(cardEl.getAttribute('data-card-index') || '0', 10);
          const rect = cardEl.getBoundingClientRect();
          const isAfter = clientY > rect.top + rect.height / 2;
          const targetIdx = isAfter ? cIdx + 1 : cIdx;

          setDragOverTarget(prev => {
            if (prev && prev.parentId === pId && prev.grandparentId === gpId && prev.index === targetIdx) {
              return prev;
            }
            return { parentId: pId, grandparentId: gpId, index: targetIdx };
          });
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      setPointerDrag(prev => prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null);
      updateTarget(e.clientX, e.clientY);
    };

    const handleWheel = () => {
      requestAnimationFrame(() => {
        if (pointerDragRef.current) {
          updateTarget(pointerDragRef.current.currentX, pointerDragRef.current.currentY);
        }
      });
    };

    const handlePointerUp = () => {
      const currentDrag = pointerDragRef.current;
      const target = dragOverTargetRef.current;

      if (currentDrag && target) {
        if (currentDrag.dragType === 'section' && target.parentId === 'section-root' && target.targetSectionId) {
          handleReorderSection(currentDrag.item.id, target.targetSectionId, !!target.isAfter);
        } else if (currentDrag.dragType === 'block' && target.parentId === 'root') {
          setDocFlow(prev => {
            let newFlow = [...prev];
            const [moved] = newFlow.splice(currentDrag.sourceIndex, 1);
            let targetIdx = target.index;
            if (currentDrag.sourceIndex < targetIdx) {
              targetIdx = targetIdx - 1;
            }
            newFlow.splice(Math.min(Math.max(0, targetIdx), newFlow.length), 0, moved);
            return newFlow;
          });
        } else if (currentDrag.dragType === 'subblock' && target.grandparentId === 'subblock-container') {
          setDocFlow(prev => prev.map(el => {
            if (el.id === currentDrag.sourceParentId && el.subblocks) {
              let newSubs = [...el.subblocks];
              const [moved] = newSubs.splice(currentDrag.sourceIndex, 1);
              let targetIdx = target.index;
              if (currentDrag.sourceIndex < targetIdx) {
                targetIdx = targetIdx - 1;
              }
              newSubs.splice(Math.min(Math.max(0, targetIdx), newSubs.length), 0, moved);
              return { ...el, subblocks: newSubs };
            }
            return el;
          }));
        } else if (currentDrag.dragType === 'item') {
          const src = {
            id: currentDrag.item.id,
            parentId: currentDrag.sourceParentId,
            grandparentId: currentDrag.sourceGrandparentId
          };
          handleReorderItem(src, target.parentId, target.grandparentId, target.index);
        }
      }

      setPointerDrag(null);
      setDragOverTarget(null);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('wheel', handleWheel, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('wheel', handleWheel);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [!!pointerDrag]);

  const handleCopy = (
    type: 'section' | 'block' | 'subblock' | 'item',
    data: any
  ) => {
    if (type === 'section') {
      const chunk = getSectionChunkElements(docFlow, data.id);
      setClipboard({
        action: 'copy',
        type: 'section',
        items: [{ data: JSON.parse(JSON.stringify(chunk)), sourceId: data.id }]
      });
      return;
    }

    setClipboard({
      action: 'copy',
      type,
      items: [{ data: JSON.parse(JSON.stringify(data)), sourceId: data.id }]
    });
  };

  const handleCut = (
    type: 'section' | 'block' | 'subblock' | 'item',
    data: any,
    sourceId: string | number,
    sourceParentId?: string,
    sourceGrandparentId?: string
  ) => {
    if (type === 'section') {
      const chunk = getSectionChunkElements(docFlow, sourceId as string);
      setClipboard({
        action: 'cut',
        type: 'section',
        items: [{ data: chunk, sourceId, sourceIds: chunk.map(c => c.id) }]
      });
      return;
    }

    setClipboard({
      action: 'cut',
      type,
      items: [{ data, sourceId, sourceParentId, sourceGrandparentId }]
    });
  };

  const handleReorderSection = (sourceSectionId: string, targetSectionId: string, isAfter: boolean) => {
    setDocFlow(prev => {
      let unsectioned: DocElement[] = [];
      let chunks: Array<{ sectionId: string; elements: DocElement[] }> = [];
      let currentChunk: { sectionId: string; elements: DocElement[] } | null = null;

      for (const el of prev) {
        if (el.type === 'section') {
          if (currentChunk) chunks.push(currentChunk);
          currentChunk = { sectionId: el.id, elements: [el] };
        } else {
          if (currentChunk) {
            currentChunk.elements.push(el);
          } else {
            unsectioned.push(el);
          }
        }
      }
      if (currentChunk) chunks.push(currentChunk);

      const srcIdx = chunks.findIndex(c => c.sectionId === sourceSectionId);
      let tgtIdx = chunks.findIndex(c => c.sectionId === targetSectionId);

      if (srcIdx === -1 || tgtIdx === -1) return prev;

      const [movedChunk] = chunks.splice(srcIdx, 1);
      tgtIdx = chunks.findIndex(c => c.sectionId === targetSectionId);
      const insertIdx = isAfter ? tgtIdx + 1 : tgtIdx;

      chunks.splice(insertIdx, 0, movedChunk);

      let result: DocElement[] = [...unsectioned];
      for (const c of chunks) {
        result.push(...c.elements);
      }
      return result;
    });
  };

  const handleReorderItem = (
    source: { id: string | number; parentId: string; grandparentId?: string },
    targetParentId: string,
    targetGrandparentId: string | undefined,
    targetIndex: number
  ) => {
    setDocFlow(prev => {
      let newFlow = JSON.parse(JSON.stringify(prev)) as DocElement[];
      let finalTargetIndex = targetIndex;
      
      // 1. Find and extract source item
      let movedItem: any = null;
      if (source.grandparentId) {
        const block = newFlow.find(b => b.id === source.parentId);
        if (block && block.subblocks) {
          const sub = block.subblocks.find(s => s.id === source.grandparentId);
          if (sub && sub.items) {
            const idx = sub.items.findIndex(i => i.id === source.id);
            if (idx !== -1) {
              [movedItem] = sub.items.splice(idx, 1);
              if (source.parentId === targetParentId && source.grandparentId === targetGrandparentId && idx < finalTargetIndex) {
                finalTargetIndex = finalTargetIndex - 1;
              }
            }
          }
        }
      } else {
        const block = newFlow.find(b => b.id === source.parentId);
        if (block && block.items) {
          const idx = block.items.findIndex(i => i.id === source.id);
          if (idx !== -1) {
            [movedItem] = block.items.splice(idx, 1);
            if (source.parentId === targetParentId && !targetGrandparentId && idx < finalTargetIndex) {
              finalTargetIndex = finalTargetIndex - 1;
            }
          }
        }
      }

      if (!movedItem) return prev;

      // 2. Insert into target
      if (targetGrandparentId) {
        const block = newFlow.find(b => b.id === targetParentId);
        if (block && block.subblocks) {
          const sub = block.subblocks.find(s => s.id === targetGrandparentId);
          if (sub) {
            if (!sub.items) sub.items = [];
            const safeIdx = Math.min(Math.max(0, finalTargetIndex), sub.items.length);
            sub.items.splice(safeIdx, 0, movedItem);
          }
        }
      } else {
        const block = newFlow.find(b => b.id === targetParentId);
        if (block) {
          if (!block.items) block.items = [];
          const safeIdx = Math.min(Math.max(0, finalTargetIndex), block.items.length);
          block.items.splice(safeIdx, 0, movedItem);
        }
      }

      return newFlow;
    });
  };

  const handlePasteSection = (targetSectionId?: string, position: 'before' | 'after' = 'after') => {
    if (!clipboard || clipboard.type !== 'section') return;

    setDocFlow(prev => {
      let unsectioned: DocElement[] = [];
      let chunks: Array<{ sectionId: string; elements: DocElement[] }> = [];
      let currentChunk: { sectionId: string; elements: DocElement[] } | null = null;

      for (const el of prev) {
        if (el.type === 'section') {
          if (currentChunk) chunks.push(currentChunk);
          currentChunk = { sectionId: el.id, elements: [el] };
        } else {
          if (currentChunk) {
            currentChunk.elements.push(el);
          } else {
            unsectioned.push(el);
          }
        }
      }
      if (currentChunk) chunks.push(currentChunk);

      let movedChunks: Array<{ sectionId: string; elements: DocElement[] }> = [];
      const cutIds = new Set(clipboard.items.map((i: any) => i.sourceId));

      if (clipboard.action === 'cut') {
        const remainingChunks: Array<{ sectionId: string; elements: DocElement[] }> = [];
        for (const c of chunks) {
          if (cutIds.has(c.sectionId)) {
            movedChunks.push(c);
          } else {
            remainingChunks.push(c);
          }
        }
        chunks = remainingChunks;
      } else {
        clipboard.items.forEach((clipboardItem: any) => {
          const rawEls = Array.isArray(clipboardItem.data) ? clipboardItem.data : [clipboardItem.data];
          const newEls = rawEls.map((el: DocElement) => regenerateIds(el));
          const secEl = newEls.find((el: DocElement) => el.type === 'section') || newEls[0];
          movedChunks.push({ sectionId: secEl.id, elements: newEls });
        });
      }

      if (movedChunks.length === 0) return prev;

      if (targetSectionId) {
        const tgtIdx = chunks.findIndex(c => c.sectionId === targetSectionId);
        if (tgtIdx !== -1) {
          const insertIdx = position === 'after' ? tgtIdx + 1 : tgtIdx;
          chunks.splice(insertIdx, 0, ...movedChunks);
        } else {
          chunks.push(...movedChunks);
        }
      } else {
        chunks.push(...movedChunks);
      }

      let result: DocElement[] = [...unsectioned];
      for (const c of chunks) {
        result.push(...c.elements);
      }
      return result;
    });

    setClipboard(null);
  };

  const handlePaste = (targetType: 'root' | 'section' | 'block' | 'subblock', targetId?: string, insertIndex?: number) => {
    if (!clipboard) return;

    if (clipboard.type === 'section') {
      // Direct section paste with chunks
      setDocFlow(prev => {
        let unsectioned: DocElement[] = [];
        let chunks: Array<{ sectionId: string; elements: DocElement[] }> = [];
        let currentChunk: { sectionId: string; elements: DocElement[] } | null = null;

        for (const el of prev) {
          if (el.type === 'section') {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = { sectionId: el.id, elements: [el] };
          } else {
            if (currentChunk) {
              currentChunk.elements.push(el);
            } else {
              unsectioned.push(el);
            }
          }
        }
        if (currentChunk) chunks.push(currentChunk);

        let movedChunks: Array<{ sectionId: string; elements: DocElement[] }> = [];
        const cutIds = new Set(clipboard.items.map((i: any) => i.sourceId));

        if (clipboard.action === 'cut') {
          const remainingChunks: Array<{ sectionId: string; elements: DocElement[] }> = [];
          for (const c of chunks) {
            if (cutIds.has(c.sectionId)) {
              movedChunks.push(c);
            } else {
              remainingChunks.push(c);
            }
          }
          chunks = remainingChunks;
        } else {
          clipboard.items.forEach((clipboardItem: any) => {
            const rawEls = Array.isArray(clipboardItem.data) ? clipboardItem.data : [clipboardItem.data];
            const newEls = rawEls.map((el: DocElement) => regenerateIds(el));
            const secEl = newEls.find((el: DocElement) => el.type === 'section') || newEls[0];
            movedChunks.push({ sectionId: secEl.id, elements: newEls });
          });
        }

        if (movedChunks.length === 0) return prev;

        if (insertIndex !== undefined) {
          let targetChunkIdx = chunks.length;
          let currentOffset = unsectioned.length;
          for (let ci = 0; ci < chunks.length; ci++) {
            if (currentOffset >= insertIndex) {
              targetChunkIdx = ci;
              break;
            }
            currentOffset += chunks[ci].elements.length;
          }
          chunks.splice(targetChunkIdx, 0, ...movedChunks);
        } else {
          chunks.push(...movedChunks);
        }

        let result: DocElement[] = [...unsectioned];
        for (const c of chunks) {
          result.push(...c.elements);
        }
        return result;
      });

      setClipboard(null);
      return;
    }

    setDocFlow(prev => {
      let newFlow = JSON.parse(JSON.stringify(prev)) as DocElement[];

      // 1. Remove from source (only when cutting)
      if (clipboard.action === 'cut') {
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
      }

      // 2. Prepare data to paste
      const pasteDatas = clipboard.items.map(clipboardItem => {
        if (clipboard.type === 'item') {
          if (clipboard.action === 'copy') {
            return { ...clipboardItem.data, id: Date.now() + Math.floor(Math.random() * 10000) };
          }
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

      // 3. Insert into target with index offset compensation for cut operations
      if (targetType === 'root' && clipboard.type === 'block') {
        let finalInsertIndex = insertIndex;
        if (insertIndex !== undefined && clipboard.action === 'cut') {
          const cutRootIds = new Set(clipboard.items.filter((i: any) => !i.sourceParentId).map((i: any) => i.sourceId));
          let removedCount = 0;
          for (let i = 0; i < Math.min(insertIndex, prev.length); i++) {
            if (cutRootIds.has(prev[i].id)) removedCount++;
          }
          finalInsertIndex = Math.max(0, insertIndex - removedCount);
        }
        insertOrPush(newFlow, pasteDatas, finalInsertIndex);
      } else if (targetType === 'section' && (clipboard.type === 'block' || clipboard.type === 'subblock')) {
        let insertPos = -1;
        if (insertIndex !== undefined) {
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
           insertPos = newFlow.findIndex(el => el.id === targetId) + 1;
        }

        if (insertPos !== -1) {
          newFlow.splice(insertPos, 0, ...pasteDatas);
        }
      } else if (targetType === 'block' && clipboard.type === 'subblock') {
        const block = newFlow.find(el => el.id === targetId);
        if (block) {
          if (!block.subblocks) block.subblocks = [];
          let finalInsertIndex = insertIndex;
          if (insertIndex !== undefined && clipboard.action === 'cut') {
            const prevBlock = prev.find(el => el.id === targetId);
            if (prevBlock && prevBlock.subblocks) {
              const cutIds = new Set(clipboard.items.filter((i: any) => i.sourceParentId === targetId).map((i: any) => i.sourceId));
              let removedCount = 0;
              for (let i = 0; i < Math.min(insertIndex, prevBlock.subblocks.length); i++) {
                if (cutIds.has(prevBlock.subblocks[i].id)) removedCount++;
              }
              finalInsertIndex = Math.max(0, insertIndex - removedCount);
            }
          }
          insertOrPush(block.subblocks, pasteDatas, finalInsertIndex);
        }
      } else if (targetType === 'block' && clipboard.type === 'item') {
        const block = newFlow.find(el => el.id === targetId);
        if (block) {
          if (!block.items) block.items = [];
          let finalInsertIndex = insertIndex;
          if (insertIndex !== undefined && clipboard.action === 'cut') {
            const prevBlock = prev.find(el => el.id === targetId);
            if (prevBlock && prevBlock.items) {
              const cutIds = new Set(clipboard.items.filter((i: any) => i.sourceParentId === targetId && !i.sourceGrandparentId).map((i: any) => i.sourceId));
              let removedCount = 0;
              for (let i = 0; i < Math.min(insertIndex, prevBlock.items.length); i++) {
                if (cutIds.has(prevBlock.items[i].id)) removedCount++;
              }
              finalInsertIndex = Math.max(0, insertIndex - removedCount);
            }
          }
          insertOrPush(block.items, pasteDatas, finalInsertIndex);
        }
      } else if (targetType === 'subblock' && clipboard.type === 'item') {
        for (const block of newFlow) {
          if (block.type === 'block' && block.subblocks) {
            const sub = block.subblocks.find(s => s.id === targetId);
            if (sub) {
              if (!sub.items) sub.items = [];
              let finalInsertIndex = insertIndex;
              if (insertIndex !== undefined && clipboard.action === 'cut') {
                let prevSub: any = null;
                for (const pb of prev) {
                  if (pb.subblocks) {
                    const found = pb.subblocks.find(s => s.id === targetId);
                    if (found) { prevSub = found; break; }
                  }
                }
                if (prevSub && prevSub.items) {
                  const cutIds = new Set(clipboard.items.filter((i: any) => i.sourceGrandparentId === targetId).map((i: any) => i.sourceId));
                  let removedCount = 0;
                  for (let i = 0; i < Math.min(insertIndex, prevSub.items.length); i++) {
                    if (cutIds.has(prevSub.items[i].id)) removedCount++;
                  }
                  finalInsertIndex = Math.max(0, insertIndex - removedCount);
                }
              }
              insertOrPush(sub.items, pasteDatas, finalInsertIndex);
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
      const targetBlock = docFlow.find(b => b.id === searchTarget.elementId);
      let targetImportance = targetBlock?.importance_rank ?? 3;
      if (searchTarget.subblockId && targetBlock && targetBlock.subblocks) {
        const targetSub = targetBlock.subblocks.find(s => s.id === searchTarget.subblockId);
        targetImportance = targetSub?.importance_rank ?? targetImportance;
      }

      // Create ListItem in backend database
      const response = await apiClient.post(`/lists/${guide.id}/items`, {
        item_type: media.item_type,
        external_id: media.external_id,
        title: media.title,
        image_url: media.image_url,
        custom_notes: media.description,
        section: null,
        importance_rank: targetImportance,
        order_index: 0
      });

      const newItem = { ...response.data, importance_rank: targetImportance };

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



  if (IS_CREATE_GUIDE_IN_DEVELOPMENT && !currentUser?.is_admin) {
    return (
      <div style={{ maxWidth: '640px', margin: '4rem auto', padding: '0 1rem', textAlign: 'center' }}>
        <div 
          className="glass-card" 
          style={{ 
            padding: '3.5rem 2rem', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '1.5rem',
            borderRadius: '16px'
          }}
        >
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(245, 158, 11, 0.2))',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f59e0b'
          }}>
            <Sparkles size={36} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span style={{ 
              fontSize: '0.8rem', 
              fontWeight: 700, 
              color: '#f59e0b', 
              textTransform: 'uppercase', 
              letterSpacing: '0.08em',
              background: 'rgba(245, 158, 11, 0.12)',
              padding: '0.3rem 0.8rem',
              borderRadius: '20px',
              alignSelf: 'center'
            }}>
              {language === 'es' ? 'Próximamente' : 'Coming Soon'}
            </span>
            <h2 style={{ margin: '0.5rem 0 0 0', fontSize: '1.75rem', fontWeight: 800 }}>
              {language === 'es' ? 'Sección en Desarrollo' : 'Section in Development'}
            </h2>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: '480px' }}>
              {language === 'es' 
                ? 'Estamos perfeccionando la herramienta de creación de guías interactivas para que tengas la mejor experiencia. ¡Muy pronto disponible para toda la comunidad de Pathd!'
                : 'We are perfecting the interactive guide creator to give you the best experience. It will be available to all Pathd users very soon!'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'center' }}>
            <button 
              onClick={() => navigate('/')} 
              className="btn-primary" 
              style={{ padding: '0.75rem 2rem' }}
            >
              {language === 'es' ? 'Volver al Inicio' : 'Back to Home'}
            </button>
          </div>
        </div>
      </div>
    );
  }


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
          <AdBanner style={{ marginTop: '2rem' }} />
        </form>
      ) : (
        /* STEP 2: RICH DOCUMENT-STYLE EDITOR CANVAS */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {guide && guide.can_edit === false && (
            <div 
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(124, 58, 237, 0.15))',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '12px',
                padding: '1rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Crown size={24} color="#f59e0b" style={{ flexShrink: 0 }} />
                <div>
                  <h4 style={{ margin: '0 0 0.25rem 0', color: '#f59e0b', fontSize: '0.95rem' }}>
                    {language === 'es' ? 'Guía en modo Solo Lectura' : 'Read-Only Guide'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {language === 'es' 
                      ? 'En el plan gratuito puedes editar tus 2 primeras guías creadas. Pasa a Pathd Premium para editar todas tus guías.' 
                      : 'Free plan allows editing your first 2 created guides. Upgrade to Pathd Premium to edit all your guides.'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowProModal(true)} className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                {language === 'es' ? 'Desbloquear con Premium' : 'Unlock with Premium'}
              </button>
            </div>
          )}

          {/* Editor Header Tools */}
          <div className="glass-card" style={{ 
            padding: '1.25rem 2rem', 
            display: 'flex', 
            flexDirection: 'column',
            gap: '1rem', 
            position: 'sticky', 
            top: '75px', 
            zIndex: 100,
            opacity: (pointerDrag || guide?.can_edit === false) ? 0.75 : 1,
            pointerEvents: (pointerDrag || guide?.can_edit === false) ? 'none' : 'auto',
            transition: 'opacity 0.2s ease'
          }}>

            {/* Top Row: Auto-save status & Main Actions (Visibility, View Guide, Publish Changes) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              {/* Auto-save status indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {isAutoSaving ? (
                  <span>{language === 'es' ? 'Guardando borrador...' : 'Saving draft...'}</span>
                ) : lastSavedTime ? (
                  <span>{language === 'es' ? `Borrador guardado: ${lastSavedTime}` : `Draft auto-saved: ${lastSavedTime}`}</span>
                ) : null}
              </div>

              {/* Target visibility selector, View Guide & Publish action */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
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

                {guide && (() => {
                  const isPublished = guide.visibility !== 'draft';
                  return (
                    <button
                      type="button"
                      onClick={() => isPublished && navigate(`/guide/${guide.id}`)}
                      disabled={!isPublished}
                      className="btn-secondary"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        height: '38px',
                        padding: '0.5rem 1rem',
                        fontSize: '0.85rem',
                        opacity: isPublished ? 1 : 0.45,
                        cursor: isPublished ? 'pointer' : 'not-allowed'
                      }}
                      title={isPublished ? (language === 'es' ? 'Ver guía' : 'View guide') : (language === 'es' ? 'La guía debe estar publicada para poder verla' : 'The guide must be published to view it')}
                    >
                      <Eye size={16} /> {language === 'es' ? 'Ver Guía' : 'View Guide'}
                    </button>
                  );
                })()}
                <button onClick={handlePublishGuide} disabled={isSubmitting} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1.25rem', height: '38px' }}>
                  <Save size={16} /> {isSubmitting ? '...' : language === 'es' ? 'Publicar Cambios' : 'Publish Changes'}
                </button>
              </div>
            </div>

            {/* Bottom Row: Document Builders (+ Nueva Sección, + Nuevo Bloque, Pegar Sección) */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)', paddingTop: '0.85rem' }}>
              <button onClick={addSection} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.45rem 1rem' }}>
                <FolderPlus size={16} /> {language === 'es' ? '+ Nueva Sección' : '+ New Section'}
              </button>
              <button onClick={addBlock} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.45rem 1rem' }}>
                <LayoutGrid size={16} /> {language === 'es' ? '+ Nuevo Bloque' : '+ New Block'}
              </button>
              {clipboard && clipboard.type === 'section' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button onClick={() => handlePasteSection()} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.45rem 1rem' }}>
                    <ClipboardPaste size={16} /> {language === 'es' ? 'Pegar Sección al final' : 'Paste Section at end'}
                  </button>
                  <button onClick={() => setClipboard(null)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', padding: '0.45rem 0.85rem', color: '#ef4444' }}>
                    {language === 'es' ? 'Cancelar' : 'Cancel'}
                  </button>
                </div>
              )}
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
                      handlePaste={(tType, tId, idx) => {
                        if (clipboard?.type === 'section' && element.type === 'section') {
                          handlePasteSection(element.id, 'before');
                        } else {
                          handlePaste(tType, tId, idx);
                        }
                      }} 
                      indent={index > 0 && docFlow[index - 1]?.type === 'section' && clipboard?.type === 'block'}
                    />
                  );
                  
                  // SECTION ELEMENT RENDER
                  if (element.type === 'section') {
                    const isSectionCut = clipboard && clipboard.action === 'cut' && clipboard.type === 'section' && clipboard.items.some((i: any) => i.sourceId === element.id || i.id === element.id || i.data?.id === element.id || (i.sourceIds && i.sourceIds.includes(element.id)));
                    const isSectionCutActive = clipboard && clipboard.action === 'cut' && clipboard.type === 'section';

                    return (
                      <React.Fragment key={element.id}>
                        {rootPasteZone}
                        {/* Animated Drop Slot before section (when dragging a section) */}
                        {pointerDrag?.dragType === 'section' && dragOverTarget?.parentId === 'section-root' && dragOverTarget.targetSectionId === element.id && !dragOverTarget.isAfter && pointerDrag?.item.id !== element.id && (
                          <div style={{
                            height: '52px',
                            borderRadius: '8px',
                            border: '2px dashed var(--accent-primary)',
                            background: 'rgba(129, 140, 248, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent-primary)',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            margin: '0.5rem 0',
                            transition: 'all 0.15s ease'
                          }}>
                            <span>{language === 'es' ? '⬇ Soltar sección aquí' : '⬇ Drop section here'}</span>
                          </div>
                        )}

                        {/* Animated Drop Slot before section (when dragging a block) */}
                        {pointerDrag?.dragType === 'block' && dragOverTarget?.parentId === 'root' && dragOverTarget.index === index && pointerDrag?.item.id !== element.id && (
                          <div style={{
                            height: '52px',
                            borderRadius: '8px',
                            border: '2px dashed var(--accent-primary)',
                            background: 'rgba(129, 140, 248, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent-primary)',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            margin: '0.5rem 0',
                            transition: 'all 0.15s ease'
                          }}>
                            <span>{language === 'es' ? '⬇ Soltar bloque aquí' : '⬇ Drop block here'}</span>
                          </div>
                        )}

                        <div 
                          data-root-element-id={element.id}
                          data-root-index={index}
                          data-section-element-id={element.id}
                          className="document-section-block" 
                          style={{ 
                            padding: '1.5rem', 
                            background: isSectionCut ? 'rgba(245, 158, 11, 0.08)' : 'rgba(124,58,237,0.03)', 
                            borderLeft: isSectionCut ? '4px dashed #f59e0b' : '4px solid var(--accent-primary)', 
                            border: isSectionCut ? '1px dashed #f59e0b' : undefined,
                            position: 'relative', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '0.75rem', 
                            borderRadius: '0 8px 8px 0',
                            opacity: (pointerDrag?.item.id === element.id || isSectionCut) ? 0.35 : 1,
                            transition: 'opacity 0.2s ease'
                          }}
                        >
                        
                        {/* Top row: Left-aligned control actions */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <input 
                              type="checkbox" 
                              disabled={selectedElements.ids.length > 0 && (selectedElements.type !== 'section' || selectedElements.parentId !== null)} 
                              checked={selectedElements.type === 'section' && selectedElements.ids.includes(element.id)} 
                              onChange={() => toggleSelection('section', element.id)} 
                              style={{ transform: 'scale(1.15)', cursor: 'pointer', marginRight: '0.25rem' }} 
                              title={language === 'es' ? 'Seleccionar sección' : 'Select section'}
                            />
                            <button 
                              type="button" 
                              onClick={() => handleCopy('section', element)} 
                              className="btn-secondary" 
                              style={{ padding: '0.2rem 0.35rem', border: 'none', background: 'transparent', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              title={language === 'es' ? 'Copiar sección' : 'Copy section'}
                            >
                              <Copy size={15} />
                            </button>
                            <button 
                              type="button" 
                              onClick={() => handleCut('section', element, element.id)} 
                              className="btn-secondary" 
                              style={{ padding: '0.2rem 0.35rem', border: 'none', background: 'transparent', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              title={language === 'es' ? 'Cortar sección' : 'Cut section'}
                            >
                              <Scissors size={15} />
                            </button>
                            <button 
                              type="button" 
                              onClick={() => removeDocElement(element.id)} 
                              className="btn-secondary" 
                              style={{ padding: '0.2rem 0.35rem', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              title={language === 'es' ? 'Eliminar sección' : 'Delete section'}
                            >
                              <Trash2 size={15} />
                            </button>
                            {clipboard && (clipboard.type === 'block' || clipboard.type === 'subblock') && (
                              <button onClick={() => handlePaste('section', element.id)} className="btn-primary" style={{ padding: '0.2rem 0.5rem', marginLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.8rem' }}>
                                <ClipboardPaste size={13} /> {language === 'es' ? 'Pegar' : 'Paste'}
                              </button>
                            )}
                          </div>
                          
                          {isSectionCutActive && !isSectionCut && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <button 
                                type="button" 
                                onClick={() => handlePasteSection(element.id, 'before')} 
                                className="btn-primary" 
                                style={{ padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
                              >
                                <ClipboardPaste size={13} /> {language === 'es' ? 'Pegar antes' : 'Paste before'}
                              </button>
                              <button 
                                type="button" 
                                onClick={() => handlePasteSection(element.id, 'after')} 
                                className="btn-primary" 
                                style={{ padding: '0.25rem 0.6rem', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
                              >
                                <ClipboardPaste size={13} /> {language === 'es' ? 'Pegar después' : 'Paste after'}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Title Row with Drag Handle at Left */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', width: '100%' }}>
                          <div 
                            onPointerDown={(e) => {
                              if (e.button !== 0) return;
                              e.preventDefault();
                              e.stopPropagation();
                              setPointerDrag({
                                dragType: 'section',
                                item: element,
                                sourceParentId: 'root',
                                sourceIndex: index,
                                currentX: e.clientX,
                                currentY: e.clientY
                              });
                            }}
                            style={{ 
                              cursor: 'grab', 
                              color: 'var(--text-secondary)', 
                              opacity: 0.7, 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              padding: '0.2rem',
                              borderRadius: '4px',
                              flexShrink: 0,
                              touchAction: 'none',
                              transition: 'opacity 0.2s ease, color 0.2s ease'
                            }}
                            title={language === 'es' ? 'Arrastrar para reordenar sección' : 'Drag to reorder section'}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                          >
                            <Menu size={18} />
                          </div>
                          <input
                            type="text"
                            value={element.title}
                            onChange={(e) => updateDocElement(element.id, { title: e.target.value })}
                            style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent-primary)', background: 'transparent', border: 'none', borderBottom: '1px dashed var(--border-color)', outline: 'none', flex: 1, padding: '0.2rem 0' }}
                            placeholder={language === 'es' ? 'Nueva sección' : 'New section'}
                          />
                        </div>

                        {/* Description Input */}
                        <textarea
                          value={element.description}
                          onChange={(e) => updateDocElement(element.id, { description: e.target.value })}
                          style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', background: 'transparent', border: 'none', borderBottom: '1px dashed transparent', outline: 'none', width: '100%', resize: 'none', fontStyle: 'italic', lineHeight: 1.5 }}
                          placeholder={language === 'es' ? 'Escribe la descripción de esta sección...' : 'Write description for this section...'}
                          rows={2}
                        />
                      </div>

                      {/* Animated Drop Slot after section (when dragging a section) */}
                      {pointerDrag?.dragType === 'section' && dragOverTarget?.parentId === 'section-root' && dragOverTarget.targetSectionId === element.id && dragOverTarget.isAfter && pointerDrag?.item.id !== element.id && (
                        <div style={{
                          height: '52px',
                          borderRadius: '8px',
                          border: '2px dashed var(--accent-primary)',
                          background: 'rgba(129, 140, 248, 0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-primary)',
                          fontSize: '0.9rem',
                          fontWeight: 600,
                          margin: '0.5rem 0',
                          transition: 'all 0.15s ease'
                        }}>
                          <span>{language === 'es' ? '⬇ Soltar sección aquí' : '⬇ Drop section here'}</span>
                        </div>
                      )}
                      </React.Fragment>
                    );
                  }

                  // BLOCK ELEMENT RENDER
                  if (element.type === 'block') {
                    const isFirstBlockOfSection = index > 0 && docFlow[index - 1]?.type === 'section';
                    // When dragging a section, or cutting a section, hide all blocks to show only a compact list of sections
                    const isSectionCutting = clipboard && clipboard.action === 'cut' && clipboard.type === 'section';
                    if (pointerDrag?.dragType === 'section' || isSectionCutting) {
                      return null;
                    }
                    return (
                      <React.Fragment key={element.id}>
                        {rootPasteZone}
                        {/* Animated Drop Slot before block (when dragging a block) */}
                        {pointerDrag?.dragType === 'block' && dragOverTarget?.parentId === 'root' && dragOverTarget.index === index && pointerDrag?.item.id !== element.id && (
                          <div style={{
                            height: '52px',
                            borderRadius: '8px',
                            border: '2px dashed var(--accent-primary)',
                            background: 'rgba(129, 140, 248, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent-primary)',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            margin: '0.5rem 0',
                            marginLeft: isFirstBlockOfSection ? '2.5rem' : '0',
                            width: isFirstBlockOfSection ? 'calc(100% - 2.5rem)' : '100%',
                            boxSizing: 'border-box',
                            transition: 'all 0.15s ease'
                          }}>
                            <span>{language === 'es' ? '⬇ Soltar bloque aquí' : '⬇ Drop block here'}</span>
                          </div>
                        )}

                      {(() => {
                        const isBlockCut = clipboard && clipboard.action === 'cut' && clipboard.type === 'block' && clipboard.items.some((i: any) => i.sourceId === element.id || i.id === element.id || i.data?.id === element.id);

                        return (
                          <div 
                            data-root-element-id={element.id}
                            data-root-index={index}
                            style={{ 
                              padding: '2rem', 
                              border: isBlockCut ? '1px dashed #f59e0b' : '1px solid var(--border-color)', 
                              borderLeft: isBlockCut ? '4px dashed #f59e0b' : '1px solid var(--border-color)',
                              borderRadius: '12px', 
                              background: isBlockCut ? 'rgba(245, 158, 11, 0.05)' : 'var(--bg-primary)', 
                              position: 'relative', 
                              display: 'flex', 
                              flexDirection: 'column', 
                              gap: '1.25rem',
                              opacity: (pointerDrag?.item.id === element.id || isBlockCut) ? 0.35 : 1,
                              transition: 'opacity 0.2s ease, background 0.2s ease, border 0.2s ease'
                            }}
                          >
                            
                            {/* Top row: Left-aligned control actions */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.4rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <input 
                                  type="checkbox" 
                                  disabled={selectedElements.ids.length > 0 && (selectedElements.type !== 'block' || selectedElements.parentId !== null)} 
                                  checked={selectedElements.type === 'block' && selectedElements.ids.includes(element.id)} 
                                  onChange={() => toggleSelection('block', element.id)} 
                                  style={{ transform: 'scale(1.15)', cursor: 'pointer', marginRight: '0.25rem' }} 
                                  title={language === 'es' ? 'Seleccionar bloque' : 'Select block'}
                                />
                                <button 
                                  type="button" 
                                  onClick={() => handleCopy('block', element)} 
                                  className="btn-secondary" 
                                  style={{ padding: '0.2rem 0.35rem', border: 'none', background: 'transparent', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                  title={language === 'es' ? 'Copiar bloque' : 'Copy block'}
                                >
                                  <Copy size={15} />
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => handleCut('block', element, element.id)} 
                                  className="btn-secondary" 
                                  style={{ padding: '0.2rem 0.35rem', border: 'none', background: 'transparent', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                  title={language === 'es' ? 'Cortar bloque' : 'Cut block'}
                                >
                                  <Scissors size={15} />
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => removeDocElement(element.id)} 
                                  className="btn-secondary" 
                                  style={{ padding: '0.2rem 0.35rem', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                  title={language === 'es' ? 'Eliminar bloque' : 'Delete block'}
                                >
                                  <Trash2 size={15} />
                                </button>
                                {clipboard && (clipboard.type === 'subblock' || clipboard.type === 'item') && (
                                  <button onClick={() => handlePaste('block', element.id)} className="btn-primary" style={{ padding: '0.2rem 0.5rem', marginLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.8rem' }}>
                                    <ClipboardPaste size={13} /> {language === 'es' ? 'Pegar' : 'Paste'}
                                  </button>
                                )}
                              </div>

                              {isBlockCut && (
                                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '0.15rem 0.5rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                  <Scissors size={12} />
                                  {language === 'es' ? 'Bloque cortado' : 'Block cut'}
                                </span>
                              )}
                            </div>

                         {/* Title Row with Drag Handle at Left */}
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                          <div 
                            onPointerDown={(e) => {
                              if (e.button !== 0) return;
                              e.preventDefault();
                              e.stopPropagation();
                              setPointerDrag({
                                dragType: 'block',
                                item: element,
                                sourceParentId: 'root',
                                sourceIndex: index,
                                currentX: e.clientX,
                                currentY: e.clientY
                              });
                            }}
                            style={{ 
                              cursor: 'grab', 
                              color: 'var(--text-secondary)', 
                              opacity: 0.7, 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              padding: '0.2rem',
                              borderRadius: '4px',
                              flexShrink: 0,
                              touchAction: 'none',
                              transition: 'opacity 0.2s ease, color 0.2s ease'
                            }}
                            title={language === 'es' ? 'Arrastrar para reordenar bloque' : 'Drag to reorder block'}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.7'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                          >
                            <Menu size={18} />
                          </div>
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {(element.items || []).map((item, itemIndex) => {
                            const isDropTargetTop = dragOverTarget?.parentId === element.id && !dragOverTarget.grandparentId && dragOverTarget.index === itemIndex;
                            const isBeingDragged = pointerDrag?.item.id === item.id;

                            return (
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

                                {/* Animated Drop Slot before this item */}
                                {isDropTargetTop && !isBeingDragged && (
                                  <div 
                                    style={{
                                      height: '48px',
                                      borderRadius: '8px',
                                      border: '2px dashed var(--accent-primary)',
                                      background: 'rgba(129, 140, 248, 0.15)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'var(--accent-primary)',
                                      fontSize: '0.85rem',
                                      fontWeight: 600,
                                      margin: '0.2rem 0',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    <span>{language === 'es' ? '⬇ Soltar aquí' : '⬇ Drop here'}</span>
                                  </div>
                                )}

                              {(() => {
                                const isItemCut = clipboard && clipboard.action === 'cut' && clipboard.type === 'item' && clipboard.items.some((i: any) => i.sourceId === item.id || i.id === item.id || i.data?.id === item.id);

                                return (
                                  <div 
                                    data-card-item-id={item.id}
                                    data-card-parent-id={element.id}
                                    data-card-grandparent-id=""
                                    data-card-index={itemIndex}
                                    style={{ 
                                      display: 'flex', 
                                      flexDirection: 'column',
                                      gap: '0.4rem',
                                      background: isItemCut ? 'rgba(245, 158, 11, 0.08)' : (isBeingDragged ? 'rgba(30, 41, 59, 0.4)' : 'var(--bg-secondary)'), 
                                      padding: '0.5rem 0.85rem', 
                                      borderRadius: '8px', 
                                      border: isItemCut ? '1px dashed #f59e0b' : (isBeingDragged ? '1px dashed var(--accent-primary)' : '1px solid var(--border-color)'),
                                      opacity: (isBeingDragged || isItemCut) ? 0.35 : 1,
                                      transform: isBeingDragged ? 'scale(0.98)' : 'none',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    {/* Top row: Action buttons, checkbox, and item importance selector */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '0.5rem', flexWrap: 'wrap' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                        <input 
                                          type="checkbox" 
                                          disabled={selectedElements.ids.length > 0 && (selectedElements.type !== 'item' || selectedElements.parentId !== element.id)} 
                                          checked={selectedElements.type === 'item' && selectedElements.ids.includes(item.id)} 
                                          onChange={() => toggleSelection('item', item.id, element.id)} 
                                          style={{ transform: 'scale(1.1)', cursor: 'pointer', marginRight: '0.2rem' }} 
                                          title={language === 'es' ? 'Seleccionar' : 'Select'}
                                        />
                                        <button 
                                          type="button" 
                                          onClick={() => handleCopy('item', item)} 
                                          className="btn-secondary" 
                                          style={{ padding: '0.2rem 0.35rem', border: 'none', background: 'transparent', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                          title={language === 'es' ? 'Copiar' : 'Copy'}
                                        >
                                          <Copy size={15} />
                                        </button>
                                        <button 
                                          type="button" 
                                          onClick={() => handleCut('item', item, item.id, element.id)} 
                                          className="btn-secondary" 
                                          style={{ padding: '0.2rem 0.35rem', border: 'none', background: 'transparent', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                          title={language === 'es' ? 'Cortar' : 'Cut'}
                                        >
                                          <Scissors size={15} />
                                        </button>
                                        <button 
                                          type="button" 
                                          onClick={() => removeMediaItem(element.id, item.id)} 
                                          className="btn-secondary" 
                                          style={{ padding: '0.2rem 0.35rem', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                          title={language === 'es' ? 'Eliminar' : 'Delete'}
                                        >
                                          <Trash2 size={15} />
                                        </button>
                                        {isItemCut && (
                                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                            <Scissors size={11} />
                                            {language === 'es' ? 'Cortado' : 'Cut'}
                                          </span>
                                        )}
                                      </div>

                                  {/* Importance rank selector */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                                      {language === 'es' ? 'Importancia:' : 'Importance:'}
                                    </span>
                                    <select
                                      value={item.importance_rank ?? element.importance_rank ?? 3}
                                      onChange={(e) => updateItemImportance(element.id, item.id, e.target.value ? parseInt(e.target.value) : null)}
                                      style={{
                                        padding: '0.12rem 0.35rem',
                                        fontSize: '0.72rem',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-color)',
                                        color: (item.importance_rank && item.importance_rank !== (element.importance_rank ?? 3)) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                        fontWeight: (item.importance_rank && item.importance_rank !== (element.importance_rank ?? 3)) ? 700 : 400,
                                        borderRadius: '4px'
                                      }}
                                    >
                                      <option value="1">1 - {language === 'es' ? 'Extra' : 'Extra'}</option>
                                      <option value="2">2 - {language === 'es' ? 'Opcional' : 'Optional'}</option>
                                      <option value="3">3 - {language === 'es' ? 'Recomendado' : 'Recommended'}</option>
                                      <option value="4">4 - {language === 'es' ? 'Importante' : 'Important'}</option>
                                      <option value="5">5 - {language === 'es' ? 'Obligatorio' : 'Mandatory'}</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Main row: Drag handle (left), Thumbnail, and Info */}
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', width: '100%' }}>
                                  <div 
                                    onPointerDown={(e) => {
                                      if (e.button !== 0) return;
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setPointerDrag({
                                        dragType: 'item',
                                        item,
                                        sourceParentId: element.id,
                                        sourceGrandparentId: undefined,
                                        sourceIndex: itemIndex,
                                        currentX: e.clientX,
                                        currentY: e.clientY
                                      });
                                    }}
                                    style={{ 
                                      cursor: 'grab', 
                                      color: 'var(--text-secondary)', 
                                      opacity: 0.6, 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'center',
                                      padding: '0.2rem 0.3rem',
                                      borderRadius: '4px',
                                      flexShrink: 0,
                                      touchAction: 'none',
                                      transition: 'opacity 0.2s ease, color 0.2s ease'
                                    }}
                                    title={language === 'es' ? 'Arrastrar para reordenar' : 'Drag to reorder'}
                                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
                                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                                  >
                                    <Menu size={18} />
                                  </div>

                                  {item.image_url && (
                                    <img
                                      src={item.image_url}
                                      alt={item.title}
                                      onClick={() => setZoomedImage(item.image_url)}
                                      style={{ width: '36px', height: '52px', objectFit: 'cover', borderRadius: '4px', cursor: 'zoom-in', flexShrink: 0 }}
                                    />
                                  )}

                                  <div style={{ flex: 1, minWidth: 0 }}>
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
                                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{series}</span>
                                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', marginTop: '0.1rem' }}>{formattedSE}</span>
                                            {epName && <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{epName}</span>}
                                          </div>
                                        );
                                      }
                                      return <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</h5>;
                                    })()}
                                    <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', textTransform: 'capitalize', display: 'block', marginTop: '0.15rem' }}>{item.item_type}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                            </React.Fragment>
                          );
                        })}

                        {/* Animated Drop Slot at bottom of block items */}
                        {pointerDrag?.dragType === 'item' && dragOverTarget?.parentId === element.id && !dragOverTarget.grandparentId && dragOverTarget.index === (element.items || []).length && (
                          <div 
                            style={{
                              height: '48px',
                              borderRadius: '8px',
                              border: '2px dashed var(--accent-primary)',
                              background: 'rgba(129, 140, 248, 0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--accent-primary)',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              margin: '0.25rem 0',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <span>{language === 'es' ? '⬇ Soltar aquí' : '⬇ Drop here'}</span>
                          </div>
                        )}

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
                          {/* Drop slot before subblock */}
                          {dragOverTarget?.parentId === element.id && dragOverTarget.grandparentId === 'subblock-container' && dragOverTarget.index === subIndex && pointerDrag?.item.id !== sub.id && (
                            <div style={{
                              height: '44px',
                              borderRadius: '6px',
                              border: '2px dashed var(--accent-primary)',
                              background: 'rgba(129, 140, 248, 0.15)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--accent-primary)',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              margin: '0.3rem 0',
                              marginLeft: '2rem',
                              transition: 'all 0.15s ease'
                            }}>
                              <span>{language === 'es' ? '⬇ Soltar subbloque aquí' : '⬇ Drop subblock here'}</span>
                            </div>
                          )}

                          {(() => {
                            const isSubblockCut = clipboard && clipboard.action === 'cut' && clipboard.type === 'subblock' && clipboard.items.some((i: any) => i.sourceId === sub.id || i.id === sub.id || i.data?.id === sub.id);

                            return (
                              <div 
                                data-subblock-id={sub.id}
                                data-subblock-parent-id={element.id}
                                data-subblock-index={subIndex}
                                style={{ 
                                  marginLeft: '2rem', 
                                  padding: '1.25rem', 
                                  border: isSubblockCut ? '1px dashed #f59e0b' : undefined,
                                  borderLeft: isSubblockCut ? '3px dashed #f59e0b' : '2px dashed var(--border-color)', 
                                  borderRadius: isSubblockCut ? '8px' : undefined,
                                  background: isSubblockCut ? 'rgba(245, 158, 11, 0.05)' : 'transparent',
                                  display: 'flex', 
                                  flexDirection: 'column', 
                                  gap: '1rem', 
                                  position: 'relative',
                                  opacity: (pointerDrag?.item.id === sub.id || isSubblockCut) ? 0.35 : 1,
                                  transition: 'opacity 0.2s ease, background 0.2s ease, border 0.2s ease'
                                }}
                              >
                                {/* Subblock Top row: Left-aligned control actions */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '0.4rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                    <input 
                                      type="checkbox" 
                                      disabled={selectedElements.ids.length > 0 && (selectedElements.type !== 'subblock' || selectedElements.parentId !== element.id)} 
                                      checked={selectedElements.type === 'subblock' && selectedElements.ids.includes(sub.id)} 
                                      onChange={() => toggleSelection('subblock', sub.id, element.id)} 
                                      style={{ transform: 'scale(1.1)', cursor: 'pointer', marginRight: '0.25rem' }} 
                                      title={language === 'es' ? 'Seleccionar subbloque' : 'Select subblock'}
                                    />
                                    <button 
                                      type="button" 
                                      onClick={() => handleCopy('subblock', sub)} 
                                      className="btn-secondary" 
                                      style={{ padding: '0.2rem 0.35rem', border: 'none', background: 'transparent', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                      title={language === 'es' ? 'Copiar subbloque' : 'Copy subblock'}
                                    >
                                      <Copy size={15} />
                                    </button>
                                    <button 
                                      type="button" 
                                      onClick={() => handleCut('subblock', sub, sub.id, element.id)} 
                                      className="btn-secondary" 
                                      style={{ padding: '0.2rem 0.35rem', border: 'none', background: 'transparent', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                      title={language === 'es' ? 'Cortar subbloque' : 'Cut subblock'}
                                    >
                                      <Scissors size={15} />
                                    </button>
                                    <button 
                                      type="button" 
                                      onClick={() => removeDocElement(element.id, sub.id)} 
                                      className="btn-secondary" 
                                      style={{ padding: '0.2rem 0.35rem', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                      title={language === 'es' ? 'Eliminar subbloque' : 'Delete subblock'}
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                    {clipboard && clipboard.type === 'item' && (
                                      <button onClick={() => handlePaste('subblock', sub.id)} className="btn-primary" style={{ padding: '0.2rem 0.5rem', marginLeft: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.8rem' }}>
                                        <ClipboardPaste size={13} /> {language === 'es' ? 'Pegar' : 'Paste'}
                                      </button>
                                    )}
                                  </div>

                                  {isSubblockCut && (
                                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '0.15rem 0.5rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <Scissors size={12} />
                                      {language === 'es' ? 'Subbloque cortado' : 'Subblock cut'}
                                    </span>
                                  )}
                                </div>

                            {/* Subblock Title and importance */}
                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {(sub.items || []).map((item, itemIndex) => {
                                const isDropTargetTop = pointerDrag?.dragType === 'item' && dragOverTarget?.parentId === element.id && dragOverTarget.grandparentId === sub.id && dragOverTarget.index === itemIndex && pointerDrag?.item.id !== item.id;
                                const isBeingDragged = pointerDrag?.item.id === item.id;

                                return (
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

                                    {/* Animated Drop Slot before this subblock item */}
                                    {isDropTargetTop && (
                                      <div 
                                        style={{
                                          height: '42px',
                                          borderRadius: '6px',
                                          border: '2px dashed var(--accent-primary)',
                                          background: 'rgba(129, 140, 248, 0.15)',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: 'var(--accent-primary)',
                                          fontSize: '0.8rem',
                                          fontWeight: 600,
                                          margin: '0.15rem 0',
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        <span>{language === 'es' ? '⬇ Soltar aquí' : '⬇ Drop here'}</span>
                                      </div>
                                    )}

                                    {(() => {
                                      const isItemCut = clipboard && clipboard.action === 'cut' && clipboard.type === 'item' && clipboard.items.some((i: any) => i.sourceId === item.id || i.id === item.id || i.data?.id === item.id);

                                      return (
                                        <div 
                                          data-card-item-id={item.id}
                                          data-card-parent-id={element.id}
                                          data-card-grandparent-id={sub.id}
                                          data-card-index={itemIndex}
                                          style={{ 
                                            display: 'flex', 
                                            flexDirection: 'column',
                                            gap: '0.35rem',
                                            background: isItemCut ? 'rgba(245, 158, 11, 0.08)' : (isBeingDragged ? 'rgba(30, 41, 59, 0.4)' : 'var(--bg-secondary)'), 
                                            padding: '0.45rem 0.75rem', 
                                            borderRadius: '6px', 
                                            border: isItemCut ? '1px dashed #f59e0b' : (isBeingDragged ? '1px dashed var(--accent-primary)' : '1px solid var(--border-color)'),
                                            opacity: (isBeingDragged || isItemCut) ? 0.35 : 1,
                                            transform: isBeingDragged ? 'scale(0.98)' : 'none',
                                            transition: 'all 0.15s ease'
                                          }}
                                        >
                                          {/* Top row: Action buttons, checkbox, and item importance selector */}
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '0.4rem', flexWrap: 'wrap' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                              <input 
                                                type="checkbox" 
                                                disabled={selectedElements.ids.length > 0 && (selectedElements.type !== 'item' || selectedElements.parentId !== sub.id)} 
                                                checked={selectedElements.type === 'item' && selectedElements.ids.includes(item.id)} 
                                                onChange={() => toggleSelection('item', item.id, sub.id)} 
                                                style={{ transform: 'scale(1.1)', cursor: 'pointer', marginRight: '0.2rem' }} 
                                                title={language === 'es' ? 'Seleccionar' : 'Select'}
                                              />
                                              <button 
                                                type="button" 
                                                onClick={() => handleCopy('item', item)} 
                                                className="btn-secondary" 
                                                style={{ padding: '0.15rem 0.3rem', border: 'none', background: 'transparent', color: 'var(--accent-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                title={language === 'es' ? 'Copiar' : 'Copy'}
                                              >
                                                <Copy size={14} />
                                              </button>
                                              <button 
                                                type="button" 
                                                onClick={() => handleCut('item', item, item.id, element.id, sub.id)} 
                                                className="btn-secondary" 
                                                style={{ padding: '0.15rem 0.3rem', border: 'none', background: 'transparent', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                title={language === 'es' ? 'Cortar' : 'Cut'}
                                              >
                                                <Scissors size={14} />
                                              </button>
                                              <button 
                                                type="button" 
                                                onClick={() => removeMediaItem(element.id, item.id, sub.id)} 
                                                className="btn-secondary" 
                                                style={{ padding: '0.15rem 0.3rem', border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                title={language === 'es' ? 'Eliminar' : 'Delete'}
                                              >
                                                <Trash2 size={14} />
                                              </button>
                                              {isItemCut && (
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)', padding: '0.1rem 0.4rem', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                                  <Scissors size={11} />
                                                  {language === 'es' ? 'Cortado' : 'Cut'}
                                                </span>
                                              )}
                                            </div>

                                      {/* Importance rank selector */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                          {language === 'es' ? 'Importancia:' : 'Importance:'}
                                        </span>
                                        <select
                                          value={item.importance_rank ?? sub.importance_rank ?? element.importance_rank ?? 3}
                                          onChange={(e) => updateItemImportance(element.id, item.id, e.target.value ? parseInt(e.target.value) : null, sub.id)}
                                          style={{
                                            padding: '0.1rem 0.3rem',
                                            fontSize: '0.7rem',
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border-color)',
                                            color: (item.importance_rank && item.importance_rank !== (sub.importance_rank ?? element.importance_rank ?? 3)) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            fontWeight: (item.importance_rank && item.importance_rank !== (sub.importance_rank ?? element.importance_rank ?? 3)) ? 700 : 400,
                                            borderRadius: '4px'
                                          }}
                                        >
                                          <option value="1">1 - {language === 'es' ? 'Extra' : 'Extra'}</option>
                                          <option value="2">2 - {language === 'es' ? 'Opcional' : 'Optional'}</option>
                                          <option value="3">3 - {language === 'es' ? 'Recomendado' : 'Recommended'}</option>
                                          <option value="4">4 - {language === 'es' ? 'Importante' : 'Important'}</option>
                                          <option value="5">5 - {language === 'es' ? 'Obligatorio' : 'Mandatory'}</option>
                                        </select>
                                      </div>
                                    </div>

                                    {/* Main row: Drag handle (left), Thumbnail, and Info */}
                                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', width: '100%' }}>
                                      <div 
                                        onPointerDown={(e) => {
                                          if (e.button !== 0) return;
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setPointerDrag({
                                            dragType: 'item',
                                            item,
                                            sourceParentId: element.id,
                                            sourceGrandparentId: sub.id,
                                            sourceIndex: itemIndex,
                                            currentX: e.clientX,
                                            currentY: e.clientY
                                          });
                                        }}
                                        style={{ 
                                          cursor: 'grab', 
                                          color: 'var(--text-secondary)', 
                                          opacity: 0.6, 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'center',
                                          padding: '0.15rem 0.25rem',
                                          borderRadius: '4px',
                                          flexShrink: 0,
                                          touchAction: 'none',
                                          transition: 'opacity 0.2s ease, color 0.2s ease'
                                        }}
                                        title={language === 'es' ? 'Arrastrar para reordenar' : 'Drag to reorder'}
                                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
                                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.6'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
                                      >
                                        <Menu size={16} />
                                      </div>

                                      {item.image_url && (
                                        <img
                                          src={item.image_url}
                                          alt={item.title}
                                          onClick={() => setZoomedImage(item.image_url)}
                                          style={{ width: '28px', height: '40px', objectFit: 'cover', borderRadius: '3px', cursor: 'zoom-in', flexShrink: 0 }}
                                        />
                                      )}

                                      <div style={{ flex: 1, minWidth: 0 }}>
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
                                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{series}</span>
                                                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)', marginTop: '0.1rem' }}>{formattedSE}</span>
                                                {epName && <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{epName}</span>}
                                              </div>
                                            );
                                          }
                                          return <h6 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</h6>;
                                        })()}
                                        <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', textTransform: 'capitalize', display: 'block', marginTop: '0.1rem' }}>{item.item_type}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                              </React.Fragment>
                                );
                              })}

                              {/* Animated Drop Slot at bottom of subblock items */}
                              {pointerDrag?.dragType === 'item' && dragOverTarget?.parentId === element.id && dragOverTarget.grandparentId === sub.id && dragOverTarget.index === (sub.items || []).length && (
                                <div 
                                  style={{
                                    height: '42px',
                                    borderRadius: '6px',
                                    border: '2px dashed var(--accent-primary)',
                                    background: 'rgba(129, 140, 248, 0.15)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--accent-primary)',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    margin: '0.15rem 0',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  <span>{language === 'es' ? '⬇ Soltar aquí' : '⬇ Drop here'}</span>
                                </div>
                              )}

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
                        );
                      })()}
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
                      );
                    })()}
                    </React.Fragment>
                      );
                    }

                    return null;
                  })}

                  {/* Animated Drop Slot at bottom of docFlow when dragging block */}
                  {pointerDrag?.dragType === 'block' && dragOverTarget?.parentId === 'root' && dragOverTarget.index === docFlow.length && (() => {
                    const isLastFirstBlock = docFlow.length > 0 && docFlow[docFlow.length - 1]?.type === 'section';
                    return (
                      <div style={{
                        height: '52px',
                        borderRadius: '8px',
                        border: '2px dashed var(--accent-primary)',
                        background: 'rgba(129, 140, 248, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-primary)',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        margin: '0.5rem 0',
                        marginLeft: isLastFirstBlock ? '2.5rem' : '0',
                        width: isLastFirstBlock ? 'calc(100% - 2.5rem)' : '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.15s ease'
                      }}>
                        <span>{language === 'es' ? '⬇ Soltar bloque aquí' : '⬇ Drop block here'}</span>
                      </div>
                    );
                  })()}

                  <PasteZone 
                    type="section" 
                    actionTargetType="root" 
                    index={docFlow.length} 
                    label={language === 'es' ? 'Pegar Aquí' : 'Paste Here'} 
                    canPaste={clipboard?.type === 'section' || clipboard?.type === 'block'} 
                    handlePaste={(tType, tId, idx) => {
                      if (clipboard?.type === 'section') {
                        handlePasteSection();
                      } else {
                        handlePaste(tType, tId, idx);
                      }
                    }} 
                    indent={docFlow.length > 0 && docFlow[docFlow.length - 1]?.type === 'section' && clipboard?.type === 'block'}
                  />
                </div>
              )}

          </div>

        </div>
      )}

      {/* Floating Action Bar for Multi-Selection or Active Clipboard */}
      {(selectedElements.ids.length > 0 || (clipboard && clipboard.items.length > 0)) && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: 'calc(50% + 125px)',
          transform: 'translateX(-50%)',
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-glow, var(--border-color))',
          borderRadius: '24px',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.25rem',
          boxShadow: '0 16px 40px rgba(0,0,0,0.65)',
          zIndex: 1000
        }}>
          {selectedElements.ids.length > 0 ? (
            <>
              <span style={{ fontWeight: 600 }}>{selectedElements.ids.length} {language === 'es' ? 'seleccionados' : 'selected'}</span>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button onClick={handleCopyMulti} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 1rem', color: 'var(--accent-primary)', borderColor: 'rgba(129, 140, 248, 0.3)' }}>
                  <Copy size={16} /> {language === 'es' ? 'Copiar' : 'Copy'}
                </button>
                <button onClick={handleCutMulti} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 1rem', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                  <Scissors size={16} /> {language === 'es' ? 'Cortar' : 'Cut'}
                </button>
                <button onClick={handleDeleteMulti} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 1rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                  <Trash2 size={16} /> {language === 'es' ? 'Eliminar' : 'Delete'}
                </button>
                <button onClick={() => setSelectedElements({ parentId: null, type: null, ids: [] })} className="btn-secondary" style={{ padding: '0.4rem 1rem' }}>
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
              </div>
            </>
          ) : (
            <>
              <span style={{ fontWeight: 600 }}>
                {clipboard?.items.length === 1 
                  ? (language === 'es' ? '1 seleccionado' : '1 selected')
                  : `${clipboard?.items.length} ${language === 'es' ? 'seleccionados' : 'selected'}`
                }
              </span>
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button onClick={() => setClipboard(null)} className="btn-secondary" style={{ padding: '0.4rem 1rem' }}>
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
              </div>
            </>
          )}
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

      {/* Floating Ghost Preview when dragging with pointer */}
      {pointerDrag && (
        <div style={{
          position: 'fixed',
          left: pointerDrag.currentX + 16,
          top: pointerDrag.currentY - 24,
          pointerEvents: 'none',
          zIndex: 9999,
          background: 'var(--bg-primary)',
          border: '1px solid var(--accent-primary)',
          boxShadow: '0 14px 32px rgba(0,0,0,0.6)',
          borderRadius: '8px',
          padding: '0.5rem 0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          width: '280px',
          opacity: 0.95,
          transform: 'scale(1.02)'
        }}>
          {pointerDrag.dragType === 'section' ? (
            <>
              <div style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center' }}>
                <FolderPlus size={20} />
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pointerDrag.item.title || (language === 'es' ? 'Sección' : 'Section')}
                </p>
                <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', textTransform: 'capitalize', display: 'block' }}>
                  {language === 'es' ? 'Sección (con sus bloques)' : 'Section (with blocks)'}
                </span>
              </div>
            </>
          ) : pointerDrag.dragType === 'block' ? (
            <>
              <div style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center' }}>
                <LayoutGrid size={20} />
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pointerDrag.item.title || (language === 'es' ? 'Bloque' : 'Block')}
                </p>
                <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', textTransform: 'capitalize', display: 'block' }}>
                  {language === 'es' ? 'Bloque' : 'Block'} ({(pointerDrag.item.items || []).length} items)
                </span>
              </div>
            </>
          ) : pointerDrag.dragType === 'subblock' ? (
            <>
              <div style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center' }}>
                <FolderPlus size={18} />
              </div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {pointerDrag.item.title || (language === 'es' ? 'Subbloque' : 'Subblock')}
                </p>
                <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', textTransform: 'capitalize', display: 'block' }}>
                  {language === 'es' ? 'Subbloque' : 'Subblock'} ({(pointerDrag.item.items || []).length} items)
                </span>
              </div>
            </>
          ) : (
            <>
              {pointerDrag.item.image_url && (
                <img src={pointerDrag.item.image_url} alt="" style={{ width: '28px', height: '40px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
              )}
              <div style={{ overflow: 'hidden', flex: 1 }}>
                {(() => {
                  const match = (pointerDrag.item.title || '').match(/^(.*?)\s*-\s*S(\d+)E(\d+)(.*)$/i);
                  if (match) {
                    const series = match[1].trim();
                    const s = match[2];
                    const e = match[3];
                    const epName = match[4].replace(/^\s*-\s*/, '').trim();
                    const formattedSE = language === 'es' ? `T${s} | E${e}` : `S${s} | E${e}`;
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{series}</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-primary)', marginTop: '0.1rem' }}>{formattedSE}</span>
                        {epName && <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '0.1rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{epName}</span>}
                      </div>
                    );
                  }
                  return (
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {pointerDrag.item.title}
                    </p>
                  );
                })()}
                <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', textTransform: 'capitalize', display: 'block', marginTop: '0.1rem' }}>
                  {pointerDrag.item.item_type}
                </span>
              </div>
            </>
          )}
        </div>
      )}
      {/* Pro Modal */}
      {showProModal && (
        <ProModal onClose={() => setShowProModal(false)} />
      )}
    </div>
  );
};
export default CreateGuide;
