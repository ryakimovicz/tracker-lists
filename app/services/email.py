import json
import urllib.request
import urllib.error
from typing import Optional
from app.core.config import settings

class EmailService:
    @classmethod
    def send_email(cls, to_email: str, subject: str, html_content: str) -> bool:
        """
        Sends an email using the Resend REST API.
        Falls back gracefully and logs if API key is missing or request fails.
        """
        api_key = getattr(settings, "RESEND_API_KEY", None)
        if not api_key:
            print(f"[EmailService] RESEND_API_KEY not configured. Email to {to_email} not sent.")
            return False

        from_email = getattr(settings, "EMAILS_FROM_EMAIL", "Pathd <noreply@pathd.net>")
        
        payload = {
            "from": from_email,
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }

        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "Pathd/1.0"
            },
            method="POST"
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status in (200, 201):
                    res_body = json.loads(response.read().decode())
                    print(f"[EmailService] Email successfully sent to {to_email}. ID: {res_body.get('id')}")
                    return True
                else:
                    print(f"[EmailService] Resend API returned status {response.status}")
                    return False
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode() if e.fp else str(e)
            print(f"[EmailService] HTTPError sending email to {to_email}: {e.code} - {err_msg}")
            return False
        except Exception as e:
            print(f"[EmailService] Exception sending email to {to_email}: {str(e)}")
            return False

    @classmethod
    def send_verification_email(cls, to_email: str, username: str, token: str) -> bool:
        """
        Sends account confirmation email with a verification link.
        """
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/")
        verification_link = f"{frontend_url}/verify-email?token={token}"

        html_content = f"""
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifica tu cuenta en Pathd</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #f8fafc;
    }}
    .container {{
      max-width: 560px;
      margin: 40px auto;
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }}
    .header {{
      background: linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%);
      padding: 32px 24px;
      text-align: center;
    }}
    .header h1 {{
      margin: 0;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #ffffff;
    }}
    .content {{
      padding: 36px 32px;
      line-height: 1.6;
    }}
    .content h2 {{
      margin-top: 0;
      font-size: 20px;
      color: #ffffff;
      font-weight: 600;
    }}
    .content p {{
      color: #94a3b8;
      font-size: 15px;
      margin: 16px 0;
    }}
    .btn-container {{
      text-align: center;
      margin: 32px 0;
    }}
    .btn {{
      display: inline-block;
      background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      font-weight: 600;
      font-size: 16px;
      border-radius: 10px;
      box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);
    }}
    .footer {{
      padding: 24px 32px;
      background: #0d131f;
      border-top: 1px solid #1f2937;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }}
    .alt-link {{
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #1f2937;
      font-size: 13px;
      color: #64748b;
      word-break: break-all;
    }}
    .alt-link a {{
      color: #a78bfa;
      text-decoration: underline;
    }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Pathd</h1>
    </div>
    <div class="content">
      <h2>¡Hola, {username}! 👋</h2>
      <p>Gracias por unirte a <strong>Pathd</strong>, tu plataforma para organizar, descubrir y llevar el seguimiento de tus películas, series, animes, libros, cómics, mangas y videojuegos favoritos.</p>
      <p>Para activar tu cuenta y empezar a crear tus estanterías, por favor confirma tu dirección de correo electrónico haciendo clic en el siguiente botón:</p>
      
      <div class="btn-container">
        <a href="{verification_link}" class="btn" target="_blank">Confirmar mi Cuenta</a>
      </div>

      <p>Este enlace de confirmación expirará en 24 horas.</p>

      <div class="alt-link">
        <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
        <a href="{verification_link}">{verification_link}</a>
      </div>
    </div>
    <div class="footer">
      <p>Si tú no creaste esta cuenta en Pathd, puedes ignorar este mensaje con total tranquilidad.</p>
      <p>© {settings.PROJECT_NAME} • Tu universo de entretenimiento organizado.</p>
    </div>
  </div>
</body>
</html>
        """
        return cls.send_email(
            to_email=to_email,
            subject="🚀 Confirma tu cuenta en Pathd",
            html_content=html_content
        )
