import React, { useState, useEffect } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import {
  Plus,
  ArrowRight,
  PlusCircle,
  Import,
  AlertCircle,
  CheckCircle,
  FolderPlus
} from 'lucide-react';

interface CreatedGuide {
  id: number;
  title: string;
  description: string;
  visibility: string;
  importance_labels: Record<string, string>;
  section_importances: Record<string, number>;
  section_descriptions: Record<string, string>;
  items: any[];
}

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

  // Step 2: Editor actions state
  const [sections, setSections] = useState<Record<string, string>>({});
  
  // Section Manager inputs
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newSectionDescription, setNewSectionDescription] = useState('');

  // Item Form inputs
  const [selectedSection, setSelectedSection] = useState('');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemType, setNewItemType] = useState('comic');
  const [newItemExternalId, setNewItemExternalId] = useState('');
  const [newItemImageUrl, setNewItemImageUrl] = useState('');
  
  // Rich item content
  const [newItemDescription, setNewItemDescription] = useState('');
  const [newItemSubItems, setNewItemSubItems] = useState(''); // Textarea, one per line
  
  const [newItemPriority, setNewItemPriority] = useState<number | null>(null);
  const [newItemOrder, setNewItemOrder] = useState<number>(0);

  // TMDB Importer state
  const [tmdbSeriesId, setTmdbSeriesId] = useState('');
  const [tmdbSeasonNum, setTmdbSeasonNum] = useState('1');

  // Feedback states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate sections when guide state changes
  useEffect(() => {
    if (guide) {
      setSections(guide.section_descriptions || {});
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
        section_descriptions: {}
      });
      setGuide(response.data);
      setSuccessMsg(language === 'es' ? '¡Lista/Guía creada con éxito!' : 'List/Guide created successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to create guide.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guide || !newSectionTitle.trim()) return;

    setErrorMsg('');
    setSuccessMsg('');
    try {
      const updatedDescriptions = {
        ...sections,
        [newSectionTitle.trim()]: newSectionDescription.trim()
      };

      const response = await apiClient.put(`/lists/${guide.id}`, {
        section_descriptions: updatedDescriptions
      });

      setGuide(response.data);
      setSections(updatedDescriptions);
      setSelectedSection(newSectionTitle.trim()); // Auto-select the newly created section
      setNewSectionTitle('');
      setNewSectionDescription('');
      setSuccessMsg(language === 'es' ? '¡Sección/Etapa añadida!' : 'Section/Stage added!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to add section.');
    }
  };

  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guide || !newItemTitle.trim()) return;

    setErrorMsg('');
    setSuccessMsg('');
    try {
      // Pack description and sub items list as JSON in custom_notes field
      const subItemsList = newItemSubItems
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);

      const notesPayload = JSON.stringify({
        description: newItemDescription.trim(),
        sub_items: subItemsList
      });

      // If no external_id is provided, auto-generate a fallback mock ID to satisfy the backend
      const finalExternalId = newItemExternalId.trim() || `manual-${Date.now()}`;

      const response = await apiClient.post(`/lists/${guide.id}/items`, {
        item_type: newItemType,
        external_id: finalExternalId,
        title: newItemTitle.trim(),
        image_url: newItemImageUrl.trim() || null,
        custom_notes: notesPayload,
        section: selectedSection || null,
        importance_rank: newItemPriority,
        order_index: newItemOrder
      });

      setGuide(prev => {
        if (!prev) return null;
        return {
          ...prev,
          items: [...(prev.items || []), response.data]
        };
      });

      setSuccessMsg(language === 'es' ? 'Elemento añadido a la guía.' : 'Item added to guide.');
      setNewItemTitle('');
      setNewItemExternalId('');
      setNewItemImageUrl('');
      setNewItemDescription('');
      setNewItemSubItems('');
      setNewItemPriority(null);
      setNewItemOrder(prev => prev + 1);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to add item to the guide.');
    }
  };

  const handleImportTvEpisodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guide || !tmdbSeriesId) return;

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiClient.post(`/lists/${guide.id}/items/tv-import`, {
        series_id: parseInt(tmdbSeriesId),
        import_type: 'season',
        season_number: parseInt(tmdbSeasonNum),
        starting_order_index: newItemOrder
      });

      const response = await apiClient.get(`/lists/${guide.id}`);
      setGuide(response.data);

      setSuccessMsg(language === 'es' ? '¡Episodios importados!' : 'Episodes imported!');
      setTmdbSeriesId('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to import episodes.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to parse JSON notes
  const parseNotes = (notes: string) => {
    try {
      if (notes.startsWith('{')) {
        return JSON.parse(notes);
      }
    } catch (e) {
      // fallback
    }
    return { description: notes, sub_items: [] };
  };

  // Group items by section
  const getGroupedItems = () => {
    if (!guide) return {};
    const grouped: Record<string, any[]> = {};
    
    // Seed groups with all created sections first to keep order
    Object.keys(sections).forEach(secName => {
      grouped[secName] = [];
    });
    
    // Add fallback for unsectioned
    grouped[''] = [];

    (guide.items || []).forEach(item => {
      const sec = item.section || '';
      if (!grouped[sec]) {
        grouped[sec] = [];
      }
      grouped[sec].push(item);
    });

    return grouped;
  };

  const groupedItems = getGroupedItems();

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 0', display: 'flex', flexDirection: 'column', gap: '2rem', textAlign: 'left' }}>
      
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
                    <label style={{ fontSize: '0.8rem' }}>{language === 'es' ? 'Nivel 1 (Muy Bajo)' : 'Level 1 (Very Low)'}</label>
                    <input type="text" className="input-field" value={label1} onChange={(e) => setLabel1(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem' }}>{language === 'es' ? 'Nivel 2 (Bajo)' : 'Level 2 (Low)'}</label>
                    <input type="text" className="input-field" value={label2} onChange={(e) => setLabel2(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem' }}>{language === 'es' ? 'Nivel 3 (Medio)' : 'Level 3 (Medium)'}</label>
                    <input type="text" className="input-field" value={label3} onChange={(e) => setLabel3(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem' }}>{language === 'es' ? 'Nivel 4 (Alto)' : 'Level 4 (High)'}</label>
                    <input type="text" className="input-field" value={label4} onChange={(e) => setLabel4(e.target.value)} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.8rem' }}>{language === 'es' ? 'Nivel 5 (Muy Alto)' : 'Level 5 (Very High)'}</label>
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
        /* STEP 2: GUIDE BUILDER EDITOR VIEW */
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', alignItems: 'start' }}>
          
          {/* Left Column: Form builders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Guide Info Card */}
            <div className="glass-card" style={{ padding: '2rem' }}>
              <span style={{ fontSize: '0.75rem', background: 'rgba(124,58,237,0.1)', color: 'var(--accent-primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', textTransform: 'capitalize' }}>
                {guide.visibility}
              </span>
              <h2 style={{ marginTop: '0.5rem', fontSize: '1.75rem' }}>{guide.title}</h2>
              <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>{guide.description}</p>
            </div>

            {/* Form A: Add Section/Stage */}
            <form onSubmit={handleAddSectionSubmit} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <FolderPlus size={20} color="var(--accent-primary)" /> {language === 'es' ? 'Crear Nueva Sección/Etapa' : 'Create Section/Stage'}
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>{language === 'es' ? 'Nombre de la Sección' : 'Section Name'}</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder={language === 'es' ? 'Ej. PARTE 0: FUNDAMENTOS' : 'e.g. PART 0: ESSENTIALS'}
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>{language === 'es' ? 'Descripción de la Sección' : 'Section Description'}</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder={language === 'es' ? 'Explica de qué trata esta etapa...' : 'Describe what this stage is about...'}
                  value={newSectionDescription}
                  onChange={(e) => setNewSectionDescription(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-secondary" style={{ width: '100%' }}>
                <Plus size={16} /> {language === 'es' ? 'Crear Sección' : 'Create Section'}
              </button>
            </form>

            {/* Form B: Add Item */}
            <form onSubmit={handleAddItemSubmit} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <PlusCircle size={20} color="var(--accent-primary)" /> {language === 'es' ? 'Añadir Elemento a la Lista' : 'Add Item to List'}
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem' }}>{language === 'es' ? 'Título del Elemento' : 'Element Title'}</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder={language === 'es' ? 'Ej. La creación de la Liga Original' : 'e.g. The Brave and the Bold #28'}
                  value={newItemTitle}
                  onChange={(e) => setNewItemTitle(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem' }}>{language === 'es' ? 'Sección / Etapa' : 'Section / Stage'}</label>
                  <select
                    className="input-field"
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                  >
                    <option value="">{language === 'es' ? '-- Sin Sección --' : '-- No Section --'}</option>
                    {Object.keys(sections).map(secName => (
                      <option key={secName} value={secName}>{secName}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem' }}>{language === 'es' ? 'Prioridad' : 'Priority'}</label>
                  <select
                    className="input-field"
                    value={newItemPriority || ''}
                    onChange={(e) => setNewItemPriority(e.target.value ? parseInt(e.target.value) : null)}
                  >
                    <option value="">{language === 'es' ? 'Sin prioridad definida' : 'No Priority'}</option>
                    <option value="1">1 - {label1}</option>
                    <option value="2">2 - {label2}</option>
                    <option value="3">3 - {label3}</option>
                    <option value="4">4 - {label4}</option>
                    <option value="5">5 - {label5}</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem' }}>{language === 'es' ? 'Formato' : 'Format'}</label>
                  <select className="input-field" value={newItemType} onChange={(e) => setNewItemType(e.target.value)}>
                    <option value="comic">{t('mediaComic')}</option>
                    <option value="manga">{t('mediaManga')}</option>
                    <option value="book">{t('mediaBook')}</option>
                    <option value="game">{t('mediaGame')}</option>
                    <option value="movie">{t('mediaMovie')}</option>
                    <option value="series">{t('mediaSeries')}</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem' }}>{language === 'es' ? 'ID Externo (Opcional)' : 'External ID (Optional)'}</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. 1726"
                    value={newItemExternalId}
                    onChange={(e) => setNewItemExternalId(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem' }}>{language === 'es' ? 'Descripción del Elemento' : 'Element Description'}</label>
                <textarea
                  className="input-field"
                  rows={2}
                  placeholder={language === 'es' ? 'Explica de qué trata o por qué leerlo...' : 'Why to read/watch this item...'}
                  value={newItemDescription}
                  onChange={(e) => setNewItemDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem' }}>{language === 'es' ? 'Elementos / Capítulos incluidos (uno por línea)' : 'Included issues / chapters (one per line)'}</label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder={language === 'es' ? 'Ej:\nThe Brave and the Bold #28\nJustice League of America #9' : 'e.g.:\nThe Brave and the Bold #28\nJustice League of America #9'}
                  value={newItemSubItems}
                  onChange={(e) => setNewItemSubItems(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem' }}>{language === 'es' ? 'URL de Imagen (Opcional)' : 'Image URL (Optional)'}</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="https://..."
                  value={newItemImageUrl}
                  onChange={(e) => setNewItemImageUrl(e.target.value)}
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                <Plus size={16} /> {language === 'es' ? 'Añadir Elemento' : 'Add Element'}
              </button>
            </form>

            {/* Form C: TMDB Importer */}
            <form onSubmit={handleImportTvEpisodes} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Import size={20} color="var(--accent-primary)" /> {language === 'es' ? 'Importador Automático (TMDB)' : 'TMDB TV Importer'}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                Importa temporadas completas como elementos de tu guía.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem' }}>Series TMDB ID</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. 1399"
                    value={tmdbSeriesId}
                    onChange={(e) => setTmdbSeriesId(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem' }}>{language === 'es' ? 'Temporada' : 'Season'}</label>
                  <input
                    type="number"
                    required
                    className="input-field"
                    value={tmdbSeasonNum}
                    onChange={(e) => setTmdbSeasonNum(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="btn-secondary" style={{ width: '100%' }}>
                {isSubmitting ? '...' : language === 'es' ? 'Importar en Lote' : 'Bulk Import'}
              </button>
            </form>

          </div>

          {/* Right Column: Live styled preview matching user specification */}
          <div className="glass-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '2rem', maxHeight: '1100px', overflowY: 'auto' }}>
            <h2 style={{ borderBottom: '2px solid var(--accent-primary)', paddingBottom: '0.5rem', margin: 0 }}>
              {language === 'es' ? 'Vista Previa del Contenido' : 'Content Live Preview'}
            </h2>

            {Object.keys(groupedItems).map(secName => {
              const secDesc = sections[secName] || '';
              const items = groupedItems[secName] || [];

              // Skip empty sections to keep display clean
              if (items.length === 0 && !secDesc) return null;

              return (
                <div key={secName} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '2rem' }}>
                  
                  {/* Section Header */}
                  {secName && (
                    <div style={{ textAlign: 'left', marginTop: '1rem' }}>
                      <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-primary)', fontSize: '1.35rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                        {secName.toUpperCase()}
                      </h3>
                      {secDesc && (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', fontStyle: 'italic', lineHeight: 1.5, margin: 0, paddingLeft: '1rem', borderLeft: '3px solid var(--border-color)' }}>
                          {secDesc}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Section Items */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                    {items.map((item: any) => {
                      const notes = parseNotes(item.custom_notes || '');
                      
                      // Find priority label name
                      const priorityLabel = item.importance_rank
                        ? guide.importance_labels[item.importance_rank.toString()] || `Priority ${item.importance_rank}`
                        : '';

                      return (
                        <div key={item.id} style={{ display: 'flex', gap: '1.25rem', alignItems: 'start', textAlign: 'left' }}>
                          {item.image_url && (
                            <img
                              src={item.image_url}
                              alt={item.title}
                              style={{ width: '80px', height: '115px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}
                            />
                          )}
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{item.title}</h4>
                              {priorityLabel && (
                                <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                  ({priorityLabel})
                                </span>
                              )}
                            </div>
                            
                            {notes.description && (
                              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: 1.45 }}>
                                {notes.description}
                              </p>
                            )}

                            {/* Bulleted Sub-items */}
                            {notes.sub_items && notes.sub_items.length > 0 && (
                              <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1.25rem', color: 'var(--text-primary)', fontSize: '0.85rem', fontFamily: 'monospace', listStyleType: 'circle', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                                {notes.sub_items.map((sub: string, sidx: number) => (
                                  <li key={sidx}>{sub}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                </div>
              );
            })}

            {guide.items?.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '3rem 0' }}>
                {language === 'es' ? 'Comienza a añadir secciones y elementos a tu lista.' : 'Start adding sections and items to your list.'}
              </p>
            )}

          </div>

        </div>
      )}

    </div>
  );
};
export default CreateGuide;
