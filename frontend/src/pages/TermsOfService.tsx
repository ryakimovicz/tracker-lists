import React from 'react';
import { useTranslation } from '../context/LanguageContext';
import { FileText, CheckCircle, AlertTriangle, HelpCircle, ArrowLeft, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TermsOfService: React.FC = () => {
  const { language } = useTranslation();
  const isEs = language === 'es';

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '1rem 1.5rem', lineHeight: 1.7 }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', textDecoration: 'none', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
        <ArrowLeft size={16} /> {isEs ? 'Volver al inicio' : 'Back to Home'}
      </Link>

      <div className="glass-card" style={{ padding: '2.5rem', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <FileText size={32} color="var(--accent-primary)" />
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }}>
            {isEs ? 'Términos de Servicio' : 'Terms of Service'}
          </h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
          {isEs ? 'Última actualización: 27 de agosto de 2026' : 'Last updated: August 27, 2026'}
        </p>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <CheckCircle size={20} /> {isEs ? '1. Aceptación de los Términos' : '1. Acceptance of Terms'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isEs
              ? 'Al acceder y utilizar Pathd (pathd.net), aceptas cumplir y estar sujeto a estos Términos de Servicio. Si no estás de acuerdo con alguno de ellos, no debes utilizar la plataforma.'
              : 'By accessing and using Pathd (pathd.net), you agree to comply with and be bound by these Terms of Service. If you do not agree with any part of these terms, you must not use the platform.'}
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <AlertTriangle size={20} /> {isEs ? '2. Uso Aceptable y Normas de la Comunidad' : '2. Acceptable Use & Community Guidelines'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isEs
              ? 'Te comprometes a utilizar la plataforma de forma respetuosa y legal. Está terminantemente prohibido:'
              : 'You agree to use the platform respectfully and lawfully. The following are strictly prohibited:'}
          </p>
          <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.5rem' }}>
            <li>{isEs ? 'Publicar contenido difamatorio, acosador, de odio o que infrinja derechos de autor.' : 'Posting defamatory, harassing, hateful, or copyright-infringing content.'}</li>
            <li>{isEs ? 'Publicar, buscar o distribuir contenido para adultos (+18), explícito, erótico o pornográfico. Pathd es una plataforma estrictamente orientada a entretenimiento general y familiar (SFW).' : 'Posting, searching, or sharing adult (+18), explicit, erotic, or pornographic content. Pathd is strictly a Safe For Work (SFW) / general-audience entertainment platform.'}</li>
            <li>{isEs ? 'Intentar vulnerar la seguridad, realizar scraping abusivo o saturar los servidores.' : 'Attempting to breach security, perform abusive scraping, or overload the servers.'}</li>
            <li>{isEs ? 'Crear cuentas falsas o automatizadas para manipular votos y reseñas.' : 'Creating fake or automated accounts to manipulate votes and reviews.'}</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <HelpCircle size={20} /> {isEs ? '3. Fuentes de Datos, APIs y Atribuciones de Terceros' : '3. Data Sources, APIs & Third-Party Attributions'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isEs
              ? 'Pathd indexa, organiza y muestra información descriptiva, sinopsis y portadas de medios mediante APIs y fuentes públicas de terceros. Pathd es un cliente independiente y no reclama propiedad sobre las obras con derechos de autor mostradas. Expresamos nuestro agradecimiento y crédito a las siguientes plataformas:'
              : 'Pathd indexes, organizes, and presents descriptive metadata, synopses, and artwork using public third-party APIs and sources. Pathd is an independent service and does not claim ownership over the copyrighted media displayed. We acknowledge and credit the following data providers:'}
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '1.25rem' }}>
            
            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>IGDB / Twitch</span>
                <a href="https://www.igdb.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                  igdb.com <ExternalLink size={13} />
                </a>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
                {isEs ? 'Metadatos, fechas de estreno y jerarquía de videojuegos.' : 'Video game metadata, release dates, and franchise relations.'}
              </p>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>OMDb API</span>
                <a href="https://www.omdbapi.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                  omdbapi.com <ExternalLink size={13} />
                </a>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
                {isEs ? 'Información cinematográfica y sinopsis de películas bajo licencia CC BY-NC 4.0.' : 'Movie metadata and synopses provided under CC BY-NC 4.0 license.'}
              </p>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Fanart.tv</span>
                <a href="https://fanart.tv" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                  fanart.tv <ExternalLink size={13} />
                </a>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
                {isEs ? 'Imágenes, pósters y fondos de alta definición de la comunidad.' : 'Community-contributed high definition artwork, posters, and backgrounds.'}
              </p>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>TVMaze</span>
                <a href="https://www.tvmaze.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                  tvmaze.com <ExternalLink size={13} />
                </a>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
                {isEs ? 'Estructura de temporadas, episodios y calendarios de series.' : 'TV show schedules, season guides, and episode descriptions.'}
              </p>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Comic Vine</span>
                <a href="https://comicvine.gamespot.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                  comicvine.gamespot.com <ExternalLink size={13} />
                </a>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
                {isEs ? 'Datos y tracking de volúmenes de cómics occidentales.' : 'Western comic book database and volume information.'}
              </p>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>AniList</span>
                <a href="https://anilist.co" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                  anilist.co <ExternalLink size={13} />
                </a>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
                {isEs ? 'Catálogo de manga, novelas ligeras y anime (API GraphQL).' : 'Manga, light novel, and anime catalog powered by AniList GraphQL.'}
              </p>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Google Books & Open Library</span>
                <a href="https://openlibrary.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                  openlibrary.org <ExternalLink size={13} />
                </a>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
                {isEs ? 'Metadatos bibliográficos, autores, páginas y portadas de libros.' : 'Book metadata, authors, page counts, and cover images.'}
              </p>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Last.fm</span>
                <a href="https://www.last.fm" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                  last.fm <ExternalLink size={13} />
                </a>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
                {isEs ? 'Scrobbling en tiempo real, artistas y álbumes musicales.' : 'Real-time music scrobbling, artist, and album metadata.'}
              </p>
            </div>

          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            {isEs ? '4. Limitación de Responsabilidad' : '4. Disclaimer of Warranties'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isEs
              ? 'El servicio se brinda "tal cual" (as is) sin garantías de ningún tipo. Nos reservamos el derecho de modificar o suspender el servicio con o sin previo aviso.'
              : 'The service is provided on an "as is" and "as available" basis without warranties of any kind. We reserve the right to modify or suspend the service at any time.'}
          </p>
        </section>
      </div>
    </div>
  );
};
export default TermsOfService;
