import React from 'react';
import { useTranslation } from '../context/LanguageContext';
import { FileText, CheckCircle, AlertTriangle, HelpCircle, ArrowLeft, ExternalLink, ShieldAlert, CreditCard, MessageSquare, Mail } from 'lucide-react';
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
          {isEs ? 'Última actualización: 25 de septiembre de 2026' : 'Last updated: September 25, 2026'}
        </p>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <CheckCircle size={20} /> {isEs ? '1. Aceptación de los Términos' : '1. Acceptance of Terms'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isEs
              ? 'Al acceder, registrarte o utilizar Pathd (pathd.net), aceptas cumplir de manera vinculante estos Términos de Servicio y nuestra Política de Privacidad. Si no estás de acuerdo con alguna de estas condiciones, debes abstenerte de utilizar la plataforma.'
              : 'By accessing, registering on, or using Pathd (pathd.net), you agree to be legally bound by these Terms of Service and our Privacy Policy. If you do not agree with any of these provisions, you must refrain from using the platform.'}
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <AlertTriangle size={20} /> {isEs ? '2. Uso Aceptable y Normas de la Comunidad' : '2. Acceptable Use & Community Guidelines'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isEs
              ? 'Te comprometes a utilizar la plataforma de forma respetuosa, legal y ética. Está terminantemente prohibido:'
              : 'You agree to use the platform respectfully, lawfully, and ethically. The following are strictly prohibited:'}
          </p>
          <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
            <li>{isEs ? 'Publicar contenido difamatorio, acosador, discriminatorio, de odio o que infrinja derechos de autor de terceros.' : 'Posting defamatory, harassing, discriminatory, hateful, or copyright-infringing content.'}</li>
            <li>{isEs ? 'Publicar, buscar o distribuir contenido para adultos (+18), explícito, erótico o pornográfico. Pathd es una plataforma estrictamente orientada a entretenimiento general y familiar (SFW).' : 'Posting, searching, or sharing adult (+18), explicit, erotic, or pornographic content. Pathd is strictly a Safe For Work (SFW) / general-audience entertainment platform.'}</li>
            <li>{isEs ? 'Intentar vulnerar la seguridad, realizar scraping abusivo, desestabilizar o saturar la infraestructura del servicio.' : 'Attempting to breach security, conduct abusive scraping, disrupt, or overload service infrastructure.'}</li>
            <li>{isEs ? 'Crear cuentas falsas, duplicadas o automatizadas (bots) para manipular votos, lecturas, estadísticas o reseñas.' : 'Creating fake, duplicate, or automated bot accounts to manipulate votes, reading progress, statistics, or reviews.'}</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <CreditCard size={20} /> {isEs ? '3. Suscripciones Premium, Facturación y Cancelaciones' : '3. Premium Subscriptions, Billing & Cancellations'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isEs
              ? 'Pathd ofrece acceso opcional a suscripciones Premium que desbloquean funciones avanzadas de personalización y navegación libre de publicidad:'
              : 'Pathd offers optional Premium subscriptions unlocking advanced customization features and an ad-free experience:'}
          </p>
          <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
            <li>
              <strong>{isEs ? 'Merchant of Record:' : 'Merchant of Record:'}</strong> {isEs
                ? 'Todos los pagos y cobros recurrentes son procesados de forma segura por nuestro Merchant of Record internacional, Dodo Payments (dodopayments.com). Dodo Payments se encarga de la recaudación tributaria aplicable, facturación y procesamiento bancario seguro.'
                : 'All recurring payments and checkouts are securely processed by our international Merchant of Record, Dodo Payments (dodopayments.com). Dodo Payments handles applicable tax collection, invoicing, and secure banking compliance.'}
            </li>
            <li>
              <strong>{isEs ? 'Renovación Automática:' : 'Automatic Renewal:'}</strong> {isEs
                ? 'Las suscripciones se renuevan automáticamente en base a tu período de facturación elegido (mensual o anual) hasta que decidas cancelarla.'
                : 'Subscriptions renew automatically on your chosen billing cadence (monthly or annual) until you decide to cancel.'}
            </li>
            <li>
              <strong>{isEs ? 'Cancelación en Cualquier Momento:' : 'Cancel Anytime:'}</strong> {isEs
                ? 'Puedes desactivar la renovación automática en cualquier momento desde la sección de Ajustes de tu cuenta. Mantendrás el acceso completo a los beneficios Premium hasta el fin del ciclo de facturación abonado, sin cargos adicionales.'
                : 'You can disable auto-renewal at any time directly from your account Settings. You will retain full access to Premium benefits until the end of your paid billing cycle without additional charges.'}
            </li>
            <li>
              <strong>{isEs ? 'Reembolsos:' : 'Refunds:'}</strong> {isEs
                ? 'Salvo que la ley aplicable disponga lo contrario, los pagos realizados no son reembolsables una vez activado el período facturado. Ante cualquier inconveniente de cobro o disputa, puedes contactar a nuestro equipo de soporte.'
                : 'Except where mandatory applicable law provides otherwise, payments are non-refundable once the billing period has commenced. In case of billing issues or disputes, please contact our support team.'}
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <MessageSquare size={20} /> {isEs ? '4. Contenido Generado por el Usuario (UGC) y Licencias' : '4. User-Generated Content (UGC) & Licenses'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isEs
              ? 'Al crear listas, guías, notas, reseñas, comentarios o aportes dentro de Pathd:'
              : 'When creating lists, guides, notes, reviews, comments, or contributions within Pathd:'}
          </p>
          <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
            <li>
              <strong>{isEs ? 'Propiedad de tu contenido:' : 'Ownership of your content:'}</strong> {isEs
                ? 'Conservas en todo momento la titularidad y derechos sobre los textos, opiniones y guías originales que escribas en la plataforma.'
                : 'You retain full ownership and rights over the original texts, reviews, and guides you compose on the platform.'}
            </li>
            <li>
              <strong>{isEs ? 'Licencia concedida a la plataforma:' : 'License granted to the platform:'}</strong> {isEs
                ? 'Nos concedes una licencia mundial, no exclusiva y libre de regalías para alojar, almacenar, formatear, traducir, mostrar y distribuir dicho contenido dentro de la plataforma y sus servicios asociados.'
                : 'You grant us a worldwide, non-exclusive, royalty-free license to host, store, format, translate, display, and distribute such content within the platform and its related services.'}
            </li>
            <li>
              <strong>{isEs ? 'Responsabilidad:' : 'Responsibility:'}</strong> {isEs
                ? 'Eres el único responsable del contenido que publicas y garantizas que no viola derechos de terceros ni secretos comerciales.'
                : 'You are solely responsible for the content you publish and warrant that it does not infringe upon third-party rights or trade secrets.'}
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <HelpCircle size={20} /> {isEs ? '5. Fuentes de Datos, APIs y Atribuciones de Terceros' : '5. Data Sources, APIs & Third-Party Attributions'}
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
                {isEs ? 'Estructura de temporadas, episodios y calendarios de series de televisión y anime.' : 'TV show and anime schedules, season guides, and episode descriptions.'}
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
                {isEs ? 'Catálogo de manga, manhwa y novelas ligeras (API GraphQL).' : 'Manga, manhwa, and light novel catalog powered by AniList GraphQL.'}
              </p>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Google Books</span>
                <a href="https://books.google.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                  books.google.com <ExternalLink size={13} />
                </a>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
                {isEs ? 'Metadatos bibliográficos de libros, autores, números de páginas y sinopsis.' : 'Book bibliographic metadata, authors, page counts, and synopses.'}
              </p>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Open Library</span>
                <a href="https://openlibrary.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                  openlibrary.org <ExternalLink size={13} />
                </a>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
                {isEs ? 'Catálogo bibliográfico abierto y portadas de ediciones de libros.' : 'Open book bibliographic catalog and edition cover archives.'}
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
                {isEs ? 'Scrobbling en tiempo real, estadísticas musicales y perfiles de artistas.' : 'Real-time music scrobbling, playback stats, and artist profiles.'}
              </p>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Deezer & iTunes / Apple Music</span>
                <a href="https://www.deezer.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                  deezer.com <ExternalLink size={13} />
                </a>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
                {isEs ? 'Portadas oficiales en alta fidelidad y metadatos de álbumes y pistas.' : 'High-fidelity official album artwork and track metadata fallback.'}
              </p>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>MusicBrainz</span>
                <a href="https://musicbrainz.org" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                  musicbrainz.org <ExternalLink size={13} />
                </a>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
                {isEs ? 'Enciclopedia musical comunitaria para fechas históricas de lanzamiento.' : 'Open community music encyclopedia for authentic original release dates.'}
              </p>
            </div>

            <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>KLIPY</span>
                <a href="https://klipy.co" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                  klipy.co <ExternalLink size={13} />
                </a>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>
                {isEs ? 'Biblioteca interactiva de GIFs, clips y stickers para comentarios.' : 'Interactive GIFs, clips, and stickers library for social comments.'}
              </p>
            </div>

          </div>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <ShieldAlert size={20} color="#ef4444" /> {isEs ? '6. Moderación de Contenido, Reportes y Purga de Catálogo' : '6. Content Moderation, Reporting & Catalog Purges'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isEs
              ? 'Dado que el catálogo de Pathd indexa dinámicamente metadatos y portadas de APIs externas públicas, la plataforma cuenta con un sistema de moderación activa y comunitaria:'
              : 'Since Pathd dynamically indexes metadata and cover art from public third-party APIs, the platform employs active automated and community moderation:'}
          </p>
          <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
            <li>
              {isEs
                ? 'Los usuarios registrados pueden reportar cualquier obra, tomo, comentario o reseña que contenga material explícito, pornográfico, indebido o que infrinja los estándares SFW mediante el botón de reporte.'
                : 'Registered users can report any work, volume, comment, or review containing explicit, pornographic, or inappropriate material that violates our SFW standards using the built-in report tool.'}
            </li>
            <li>
              {isEs
                ? 'El equipo de administración se reserva el derecho de banear, purgar y desindexar de forma inmediata obras, sagas, revistas o editoriales completas del sistema, removiéndolas automáticamente de listas, bibliotecas y resultados de búsqueda sin previo aviso.'
                : 'The administration team reserves the right to immediately ban, purge, and de-index specific works, sagas, magazines, or entire publishers, automatically removing them from lists, user libraries, and search results without prior notice.'}
            </li>
            <li>
              {isEs
                ? 'Las cuentas que de manera reiterada creen guías, comentarios, reseñas o elementos personalizados con contenido explícito o prohibido, o que generen reportes falsos o abusivos, podrán ser suspendidas o canceladas por el equipo de moderación.'
                : 'Accounts that repeatedly create guides, comments, reviews, or custom items containing explicit or prohibited content, or that submit false or abusive reports, may be suspended or permanently terminated by the moderation team.'}
            </li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <HelpCircle size={20} /> {isEs ? '7. Limitación de Responsabilidad' : '7. Disclaimer of Warranties'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isEs
              ? 'El servicio se brinda "tal cual" (as is) y según disponibilidad ("as available") sin garantías de ningún tipo, expresas o implícitas. No garantizamos que el servicio sea ininterrumpido, esté 100% libre de errores o que la disponibilidad de APIs de terceros se mantenga constante indefinidamente.'
              : 'The service is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied. We do not warrant that the service will be uninterrupted, error-free, or that third-party API availability will remain constant indefinitely.'}
          </p>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <CheckCircle size={20} /> {isEs ? '8. Cierre de Cuenta y Modificaciones de los Términos' : '8. Account Termination & Changes to Terms'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isEs
              ? 'Puedes eliminar tu cuenta en cualquier momento desde la sección de Ajustes, lo que borrará de forma permanente tus datos asociados. Asimismo, nos reservamos el derecho de actualizar estos Términos periódicamente. Cualquier cambio sustancial será debidamente reflejado actualizando la fecha al inicio de este documento.'
              : 'You may terminate your account at any time from your Settings page, permanently deleting your associated data. We also reserve the right to update these Terms periodically. Substantial modifications will be reflected by updating the effective date at the top of this document.'}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <Mail size={20} /> {isEs ? '9. Contacto y Consultas Legales' : '9. Legal Contact & Support'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isEs
              ? 'Para consultas de soporte técnico, facturación o funcionamiento de tu cuenta, escríbenos a '
              : 'For customer support, billing inquiries, or account assistance, please contact '}
            <a href="mailto:support@pathd.net" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>support@pathd.net</a>.
          </p>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {isEs
              ? 'Para asuntos legales, requerimientos oficiales, prensa o notificaciones de derechos de autor (DMCA), comunícate a '
              : 'For legal notices, official inquiries, press, or copyright claims (DMCA), please reach out to '}
            <a href="mailto:contact@pathd.net" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>contact@pathd.net</a>.
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsOfService;
