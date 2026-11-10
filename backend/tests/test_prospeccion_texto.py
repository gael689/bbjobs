"""Mail de prospección en texto plano (como la presentación de MBK) y aviso al candidato con
empresa, modalidad y "por qué"."""
import uuid

from app.core.config import settings
from app.integrations.resend_client import OutgoingEmail, _payload
from app.models.job import JobPosting
from app.models.prospect import Prospect
from app.services.email import prospect_dispatch as pd
from app.services.email.matches import _detail
from app.services.email.render import EmailItem, render_email


def _prospect() -> Prospect:
    return Prospect(id=uuid.uuid4(), source="leadgen", external_id="x", name="Panadería Sol", locality="Bahía Blanca")


def test_prospeccion_sale_en_texto_plano_con_baja_y_sin_logo():
    p = _prospect()
    subject, r = pd.render_for_prospect(p, subject="Hola {{empresa}}", body="Primer párrafo.\n\nSegundo.",
                                        cta_label="Conocé el portal", cta_url="/publicar-empleo")
    assert subject == "Hola Panadería Sol"
    assert r.text.startswith("Primer párrafo.\n\nSegundo.")
    assert "Conocé el portal: http" in r.text and "/publicar-empleo" in r.text
    assert "/baja?tipo=empresa&t=" in r.text and "no recibir más mails" in r.text
    assert "<img" not in r.html and "<table" not in r.html


def test_payload_sin_html_manda_solo_texto():
    body = _payload(OutgoingEmail(to="a@b.com", subject="s", html="", text="hola"))
    assert "html" not in body and body["text"] == "hola"
    assert _payload(OutgoingEmail(to="a@b.com", subject="s", html="<p>x</p>"))["html"] == "<p>x</p>"


def test_prospeccion_usa_la_misma_cuenta_y_exige_buzon_de_respuesta(monkeypatch):
    monkeypatch.setattr(settings, "PROSPECT_MODE", "auto")
    monkeypatch.setattr(settings, "PROSPECT_RESEND_API_KEY", None)
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test")
    monkeypatch.setattr(settings, "PROSPECT_REPLY_TO", None)
    assert pd.prospect_api_key() == "re_test"
    assert pd.get_prospect_sender() is None          # sin buzón, las respuestas se perderían
    monkeypatch.setattr(settings, "PROSPECT_REPLY_TO", "talency@example.com")
    assert isinstance(pd.get_prospect_sender(), pd.ResendProspectSender)
    monkeypatch.setattr(settings, "RESEND_API_KEY", None)
    assert pd.get_prospect_sender() is None


def test_aviso_al_candidato_trae_empresa_modalidad_y_por_que():
    job = JobPosting(title="Cajero", company_legal_name_snapshot="Super Sur", modality="presencial")
    assert _detail(job, "Bahía Blanca") == "Super Sur · Bahía Blanca · Presencial"
    job_remoto = JobPosting(title="Dev", company_legal_name_snapshot="Acme", modality="remoto")
    assert _detail(job_remoto, "Bahía Blanca") == "Acme · Remoto"
    r = render_email(heading="", body="intro", items=[EmailItem(title="Cajero", detail="Super Sur",
                     url="/empleos/cajero-1", why="En tu zona · Pide Excel")], item_cta="Postularme")
    assert "Por qué: En tu zona · Pide Excel" in r.text and "Por qué: En tu zona" in r.html
    assert "/empleos/cajero-1" in r.text
