import React from 'react';
import { useTranslation } from '../context/LanguageContext';
import { FileText, CheckCircle, AlertTriangle, HelpCircle, ArrowLeft } from 'lucide-react';
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
          {isEs ? 'Última actualización: 25 de agosto de 2026' : 'Last updated: August 25, 2026'}
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
            <li>{isEs ? 'Intentar vulnerar la seguridad, realizar scraping abusivo o saturar los servidores.' : 'Attempting to breach security, perform abusive scraping, or overload the servers.'}</li>
            <li>{isEs ? 'Crear cuentas falsas o automatizadas para manipular votos y reseñas.' : 'Creating fake or automated accounts to manipulate votes and reviews.'}</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <HelpCircle size={20} /> {isEs ? '3. Atribución de APIs y Fuentes de Contenido' : '3. API Attributions & Data Sources'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isEs
              ? 'Pathd indexa y muestra información descriptiva e imágenes de medios proporcionadas por APIs de terceros. Pathd no es propietaria del material con derechos de autor mostrado.'
              : 'Pathd indexes and displays descriptive metadata and cover art provided by third-party APIs. Pathd does not claim ownership of the copyrighted media displayed.'}
          </p>
          <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.5rem' }}>
            <li><strong>Videojuegos:</strong> {isEs ? 'Datos e imágenes provistos por IGDB / Twitch.' : 'Data and media powered by IGDB / Twitch.'}</li>
            <li><strong>Series y TV:</strong> {isEs ? 'Datos y cronogramas de episodios provistos por TVmaze API.' : 'Episode guides and schedules powered by TVmaze API.'}</li>
            <li><strong>Películas:</strong> {isEs ? 'Metadatos provistos por OMDb y fuentes abiertas.' : 'Metadata powered by OMDb and open sources.'}</li>
            <li><strong>Libros:</strong> {isEs ? 'Información y portadas provistas por Google Books API.' : 'Book information and covers provided by Google Books API.'}</li>
            <li><strong>Cómics & Manga:</strong> {isEs ? 'Metadatos provistos por Comic Vine y AniList.' : 'Metadata provided by Comic Vine and AniList.'}</li>
            <li><strong>Música:</strong> {isEs ? 'Scrobbling y datos provistos por Last.fm.' : 'Scrobbling and music metadata powered by Last.fm.'}</li>
          </ul>
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
