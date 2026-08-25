import React from 'react';
import { useTranslation } from '../context/LanguageContext';
import { Shield, Lock, Eye, Database, Mail, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PrivacyPolicy: React.FC = () => {
  const { language } = useTranslation();

  const isEs = language === 'es';

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '1rem 1.5rem', lineHeight: 1.7 }}>
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-primary)', textDecoration: 'none', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
        <ArrowLeft size={16} /> {isEs ? 'Volver al inicio' : 'Back to Home'}
      </Link>

      <div className="glass-card" style={{ padding: '2.5rem', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <Shield size={32} color="var(--accent-primary)" />
          <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 700 }}>
            {isEs ? 'Política de Privacidad' : 'Privacy Policy'}
          </h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '2rem' }}>
          {isEs ? 'Última actualización: 25 de agosto de 2026' : 'Last updated: August 25, 2026'}
        </p>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <Eye size={20} /> {isEs ? '1. Información que recopilamos' : '1. Information We Collect'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isEs
              ? 'Cuando utilizas Pathd, recopilamos la información mínima necesaria para brindarte el servicio:'
              : 'When you use Pathd, we collect the minimal necessary information to provide you with the service:'}
          </p>
          <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.5rem' }}>
            <li><strong>{isEs ? 'Datos de Cuenta:' : 'Account Data:'}</strong> {isEs ? 'Tu correo electrónico, nombre de usuario y contraseña hasheada de forma segura.' : 'Your email address, username, and securely hashed password.'}</li>
            <li><strong>{isEs ? 'Autenticación con Google:' : 'Google Sign-In:'}</strong> {isEs ? 'Si inicias sesión con Google, recibimos tu nombre, correo electrónico y foto de perfil pública para autenticarte.' : 'If you sign in using Google, we receive your name, email address, and public profile picture to authenticate you.'}</li>
            <li><strong>{isEs ? 'Contenido de Usuario:' : 'User Content:'}</strong> {isEs ? 'Listas de seguimiento, guías creadas, notas, progreso de lectura/visionado, reseñas y comentarios.' : 'Tracking lists, created guides, notes, reading/watching progress, reviews, and comments.'}</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <Database size={20} /> {isEs ? '2. Cómo usamos tu información' : '2. How We Use Your Information'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isEs
              ? 'Utilizamos tus datos única y exclusivamente para:'
              : 'We use your data strictly and solely to:'}
          </p>
          <ul style={{ color: 'var(--text-secondary)', paddingLeft: '1.5rem' }}>
            <li>{isEs ? 'Permitirte organizar tu progreso y sincronizar tus listas en todos tus dispositivos.' : 'Allow you to organize your progress and sync your lists across all your devices.'}</li>
            <li>{isEs ? 'Gestionar la seguridad de tu sesión mediante cookies y tokens encriptados.' : 'Manage your session security via encrypted tokens and cookies.'}</li>
            <li>{isEs ? 'Nunca vendemos, alquilamos ni compartimos tu información personal con anunciantes o terceros.' : 'We never sell, rent, or share your personal information with advertisers or third parties.'}</li>
          </ul>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <Lock size={20} /> {isEs ? '3. Tus Derechos y Eliminación de Datos (GDPR / CCPA)' : '3. Your Rights & Data Deletion (GDPR / CCPA)'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isEs
              ? 'Tienes derecho a acceder, modificar o eliminar todos tus datos en cualquier momento. Puedes borrar tu cuenta por completo desde la sección de Ajustes, lo cual eliminará de forma irreversible todas tus listas, comentarios, reseñas y datos personales de nuestros servidores.'
              : 'You have the right to access, rectify, or delete all your data at any time. You can permanently delete your account from the Settings page, which immediately and irreversibly wipes all your lists, comments, reviews, and personal data from our servers.'}
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
            <Mail size={20} /> {isEs ? '4. Contacto de Privacidad' : '4. Privacy Contact'}
          </h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            {isEs
              ? 'Si tienes dudas sobre esta Política de Privacidad o tus datos, contáctanos en '
              : 'If you have any questions about this Privacy Policy or your data, please contact us at '}
            <a href="mailto:support@pathd.net" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>support@pathd.net</a>.
          </p>
        </section>
      </div>
    </div>
  );
};
export default PrivacyPolicy;
