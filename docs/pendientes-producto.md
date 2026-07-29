# Módula 22 — Pendientes de producto

Ideas y mejoras cosméticas/funcionales que **no** son de seguridad (esas viven en
`docs/seguridad/07-hoja-de-ruta.md`). Son recordatorios para retomar después.

---

## Correo

### Logo de la marca junto al remitente (BIMI) — *pendiente, sin prisa*

Que el logo de MODULA 22 aparezca en el círculo junto al remitente en
Gmail/Outlook. **No es código de la app; es configuración de dominio + correo.**

Requisitos:

1. **DMARC en modo estricto** en el DNS de `modula22.mx` (`p=quarantine` o
   `p=reject`, no `p=none`). SPF y DKIM ya los da Resend al verificar el dominio.
2. **Logo en SVG Tiny P/S** (variante recortada de SVG, cuadrado, fondo sólido).
   Un PNG o un SVG normal no sirven.
3. **Registro DNS BIMI**: un TXT en `default._bimi.modula22.mx` apuntando a la URL
   del SVG.
4. **Certificado VMC** (Verified Mark Certificate) — el paso caro:
   - Gmail y Outlook **solo muestran el logo si hay VMC**.
   - Cuesta ~$1,000–$1,500 USD/año (DigiCert/Entrust).
   - Exige que el logo sea **marca registrada** (IMPI o equivalente).

**Decisión institucional pendiente:** si vale la pena pagar el VMC + registrar la
marca. Lo técnico (SVG en formato correcto, texto de los registros DMARC/BIMI,
verificar Resend en verde) se puede preparar del lado del equipo cuando se decida.

> Contexto: el problema real de entrega de correos (el `EMAIL_FROM` malformado que
> rompía el envío de credenciales) **ya quedó resuelto**. Esto del logo es un extra
> estético, no un bloqueo.
