import React, { useState } from 'react';
import { useTranslation } from '../context/LanguageContext';
import { apiClient } from '../api/client';
import {
  Plus,
  ArrowRight,
  PlusCircle,
  Import,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface CreatedGuide {
  id: number;
  title: string;
  description: string;
  visibility: string;
  importance_labels: Record<string, string>;
  items: any[];
}

export const CreateGuide: React.FC = () => {
  const { t, language } = useTranslation();

  // Step 1: Create Guide state
  const [guide, setGuide] = useState<CreatedGuide | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  // Custom priority labels state
  const [label1, setLabel1] = useState(language === 'es' ? 'Relleno / Opcional' : 'Filler / Optional');
  const [label3, setLabel3] = useState(language === 'es' ? 'Recomendado' : 'Recommended');
  const [label5, setLabel5] = useState(language === 'es' ? 'Canon / Esencial' : 'Canon / Essential');

  // Step 2: Editor actions state
  const [activeSection, setActiveSection] = useState('');
  const [newItemTitle, setNewItemTitle] = useState('');
  const [newItemType, setNewItemType] = useState('game');
  const [newItemExternalId, setNewItemExternalId] = useState('');
  const [newItemImageUrl, setNewItemImageUrl] = useState('');
  const [newItemNotes, setNewItemNotes] = useState('');
  const [newItemPriority, setNewItemPriority] = useState<number | null>(null);
  const [newItemOrder, setNewItemOrder] = useState<number>(0);

  // TMDB Importer state
  const [tmdbSeriesId, setTmdbSeriesId] = useState('');
  const [tmdbSeasonNum, setTmdbSeasonNum] = useState('1');

  // Feedback states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateGuideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      // Build importance labels renaming map
      const importanceLabels = {
        "1": label1,
        "3": label3,
        "5": label5
      };

      const response = await apiClient.post('/lists/', {
        title,
        description,
        visibility,
        importance_labels: importanceLabels
      });
      setGuide(response.data);
      setSuccessMsg(language === 'es' ? '¡Guía creada con éxito!' : 'Guide created successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to create guide.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guide || !newItemTitle.trim() || !newItemExternalId.trim()) return;

    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await apiClient.post(`/lists/${guide.id}/items`, {
        item_type: newItemType,
        external_id: newItemExternalId,
        title: newItemTitle,
        image_url: newItemImageUrl,
        custom_notes: newItemNotes,
        section: activeSection || null,
        importance_rank: newItemPriority,
        order_index: newItemOrder
      });

      // Update guide list view local state
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
      setNewItemNotes('');
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

      // Refetch the entire guide details to populate newly imported episodes
      const response = await apiClient.get(`/lists/${guide.id}`);
      setGuide(response.data);

      setSuccessMsg(language === 'es' ? '¡Episodios importados correctamente!' : 'Episodes imported successfully!');
      setTmdbSeriesId('');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to import episodes. Verify TMDB ID.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 0', display: 'flex', flexDirection: 'column', gap: '2rem', textAlign: 'left' }}>
      
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

      {/* STEP 1: GUIDE DETAILS CREATOR */}
      {!guide ? (
        <form onSubmit={handleCreateGuideSubmit} className="glass-card" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <h2>{language === 'es' ? 'Crear Nueva Guía Cronológica' : 'Create New Chronological Guide'}</h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{language === 'es' ? 'Título de la Guía' : 'Guide Title'}</label>
            <input
              type="text"
              required
              className="input-field"
              placeholder={language === 'es' ? 'Ej. Batman: Orden de Lectura Completo' : 'e.g. Marvel Cinematic Universe timeline'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 500 }}>{language === 'es' ? 'Descripción' : 'Description'}</label>
            <textarea
              className="input-field"
              rows={3}
              placeholder={language === 'es' ? 'De qué se trata esta cronología...' : 'What this guide is about...'}
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

          {/* Scale customization */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h4>{language === 'es' ? 'Renombrar Escala de Importancia (Opcional)' : 'Customize Importance Labels (Optional)'}</h4>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
              Asigna nombres específicos a las prioridades de tu guía.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.8rem' }}>{language === 'es' ? 'Prioridad Baja (1)' : 'Low Priority (1)'}</label>
                <input type="text" className="input-field" value={label1} onChange={(e) => setLabel1(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <label style={{ fontSize: '0.8rem' }}>{language === 'es' ? 'Prioridad Media (3)' : 'Medium Priority (3)'}</label>
                <input type="text" className="input-field" value={label3} onChange={(e) => setLabel3(e.target.value)} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <label style={{ fontSize: '0.8rem' }}>{language === 'es' ? 'Prioridad Alta (5)' : 'High Priority (5)'}</label>
                <input type="text" className="input-field" value={label5} onChange={(e) => setLabel5(e.target.value)} />
              </div>
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ marginTop: '1rem' }}>
            {language === 'es' ? 'Crear Guía' : 'Create Guide'} <ArrowRight size={18} />
          </button>
        </form>
      ) : (
        /* STEP 2: GUIDE BUILDER EDITOR VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          <div className="glass-card" style={{ padding: '2rem' }}>
            <span style={{ fontSize: '0.75rem', background: 'rgba(124,58,237,0.1)', color: 'var(--accent-primary)', padding: '0.2rem 0.5rem', borderRadius: '4px', textTransform: 'capitalize' }}>
              {guide.visibility}
            </span>
            <h2 style={{ marginTop: '0.5rem' }}>{guide.title}</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>{guide.description}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '2rem', alignItems: 'start' }}>
            {/* Left side: Add elements & TMDB Importer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Form 1: Add individual item */}
              <form onSubmit={handleAddItemSubmit} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <PlusCircle size={20} color="var(--accent-primary)" /> {language === 'es' ? 'Añadir Ítem' : 'Add Item'}
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem' }}>{language === 'es' ? 'Título del Ítem' : 'Item Title'}</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. Iron Man 1"
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.85rem' }}>{language === 'es' ? 'Formato' : 'Format'}</label>
                    <select className="input-field" value={newItemType} onChange={(e) => setNewItemType(e.target.value)}>
                      <option value="game">{t('mediaGame')}</option>
                      <option value="movie">{t('mediaMovie')}</option>
                      <option value="series">{t('mediaSeries')}</option>
                      <option value="book">{t('mediaBook')}</option>
                      <option value="comic">{t('mediaComic')}</option>
                      <option value="manga">{t('mediaManga')}</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.85rem' }}>{language === 'es' ? 'ID Externo (API)' : 'External ID (API)'}</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      placeholder="e.g. 1726"
                      value={newItemExternalId}
                      onChange={(e) => setNewItemExternalId(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.85rem' }}>{language === 'es' ? 'Sección / Arco' : 'Section / Arc'}</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder={language === 'es' ? 'Ej. Fase 1' : 'e.g. Phase 1'}
                      value={activeSection}
                      onChange={(e) => setActiveSection(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.85rem' }}>{language === 'es' ? 'Prioridad' : 'Priority'}</label>
                    <select
                      className="input-field"
                      value={newItemPriority || ''}
                      onChange={(e) => setNewItemPriority(e.target.value ? parseInt(e.target.value) : null)}
                    >
                      <option value="">{language === 'es' ? 'Heredada (Sección)' : 'Inherited'}</option>
                      <option value="1">1 - {label1}</option>
                      <option value="2">2</option>
                      <option value="3">3 - {label3}</option>
                      <option value="4">4</option>
                      <option value="5">5 - {label5}</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem' }}>{language === 'es' ? 'URL de Imagen' : 'Image URL'}</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="https://..."
                    value={newItemImageUrl}
                    onChange={(e) => setNewItemImageUrl(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ fontSize: '0.85rem' }}>{language === 'es' ? 'Notas / Recomendaciones' : 'Notes / Tips'}</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    value={newItemNotes}
                    onChange={(e) => setNewItemNotes(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                  <Plus size={16} /> {language === 'es' ? 'Añadir a la lista' : 'Add to list'}
                </button>
              </form>

              {/* Form 2: TMDB Season Importer */}
              <form onSubmit={handleImportTvEpisodes} className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                  <Import size={20} color="var(--accent-primary)" /> {language === 'es' ? 'Importar Temporada (TMDB)' : 'Import Season (TMDB)'}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                  Introduce el ID de TMDB de la serie para auto-importar sus capítulos.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ fontSize: '0.85rem' }}>Series TMDB ID</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      placeholder="e.g. 1399 (Game of Thrones)"
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
                  {isSubmitting ? 'Importing...' : language === 'es' ? 'Importar Capítulos' : 'Import Episodes'}
                </button>
              </form>

            </div>

            {/* Right side: Items Preview list */}
            <div className="glass-card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '720px', overflowY: 'auto' }}>
              <h3 style={{ margin: 0 }}>{language === 'es' ? 'Vista Previa de la Guía' : 'Guide Preview'}</h3>
              
              {(!guide.items || guide.items.length === 0) ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
                  {language === 'es' ? 'Aún no hay elementos añadidos.' : 'No items added yet.'}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {guide.items.map((item: any, index: number) => (
                    <div key={item.id || index} style={{ display: 'flex', gap: '1rem', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', textAlign: 'left' }}>
                      <img
                        src={item.image_url || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=100'}
                        alt={item.title}
                        style={{ width: '50px', height: '70px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h4 style={{ margin: '0 0 0.2rem 0', fontSize: '0.95rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', textTransform: 'capitalize' }}>
                          {item.item_type}
                        </span>
                        {item.section && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '1rem' }}>
                            ({item.section})
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
export default CreateGuide;
