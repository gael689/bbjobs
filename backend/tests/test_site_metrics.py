"""Medición propia: limpieza de eventos (funciones puras, sin base)."""
import uuid
from datetime import date, datetime, timezone

from app.services import site_metrics as sm

CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36"
IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"


def _batch(events, ua=CHROME, ref=None):
    return sm.parse_batch(events, user_agent=ua, header_referer=ref)


def test_origen_por_referrer():
    casos = {
        None: "directo",
        "": "directo",
        "https://www.google.com/": "google",
        "https://www.google.com.ar/search?q=empleo": "google",
        "https://gemini.google.com/app": "ia",
        "https://chatgpt.com/": "ia",
        "https://www.perplexity.ai/search": "ia",
        "https://claude.ai/chat/x": "ia",
        "https://copilot.microsoft.com/": "ia",
        "https://www.bing.com/search?q=x": "bing",
        "https://l.facebook.com/l.php?u=x": "redes",
        "https://www.instagram.com/": "redes",
        "https://www.linkedin.com/feed": "redes",
        "https://wa.me/549291": "redes",
        "https://t.co/abc": "redes",
        "https://x.com/bbjobs": "redes",
        "https://www.tiktok.com/@x": "redes",
        "https://bbjobs.com.ar/empleos": "interno",
        "https://www.bbjobs.com.ar/": "interno",
        "https://notgoogle.example.com/": "otro",
        "https://googleusercontent.evil.com/": "otro",
        "no es una url": "otro",
    }
    for ref, esperado in casos.items():
        assert sm.classify_source(ref) == esperado, ref


def test_bots_se_descartan_enteros():
    ev = [{"event": "page_view", "path": "/"}]
    for ua in (None, "", "Googlebot/2.1", "Mozilla/5.0 HeadlessChrome/141", "facebookexternalhit/1.1",
               "Chrome-Lighthouse", "python-requests/2.32", "curl/8.0", "WhatsApp/2.23", "Mozilla/5.0 (compatible; bingbot/2.0)",
               "Slackbot-LinkExpanding 1.0", "AhrefsBot", "Mozilla/5.0 (Linux) Google-PageRenderer Google (+preview)"):
        assert _batch(ev, ua=ua) == [], ua
    assert len(_batch(ev)) == 1


def test_dispositivo():
    assert _batch([{"event": "page_view", "path": "/"}], ua=IPHONE)[0].device == "mobile"
    assert _batch([{"event": "page_view", "path": "/"}])[0].device == "desktop"


def test_lista_blanca_y_validaciones():
    job = str(uuid.uuid4())
    eventos = [
        {"event": "page_view", "path": "/empleos?q=chofer#x"},
        {"event": "hackeo", "path": "/"},
        {"event": "page_view", "path": "https://otro.com/"},
        {"event": "page_view", "path": "//otro.com/x"},
        {"event": "page_view", "path": 12},
        {"event": "page_view", "path": "/dashboard/admin"},
        {"event": "page_view", "path": "/vista-previa/x"},
        {"event": "view_item", "path": "/empleos/x"},  # sin job_id
        {"event": "apply", "path": "/empleos/x", "job_id": "no-es-uuid"},
        {"event": "view_item", "path": "/empleos/x", "job_id": job},
        "no soy un dict",
        None,
        {"event": "publish_job", "path": "/dashboard/company/publicar", "job_id": job},
    ]
    out = _batch(eventos)
    assert [(e.event, e.path) for e in out] == [
        ("page_view", "/empleos"),
        ("view_item", "/empleos/x"),
        ("publish_job", "/dashboard/company/publicar"),
    ]
    assert out[1].job_id == uuid.UUID(job)


def test_lote_maximo_20_y_formas_de_payload():
    ev = {"event": "page_view", "path": "/"}
    assert len(_batch([ev] * 50)) == 20
    assert len(_batch({"events": [ev, ev]})) == 2
    assert _batch({"otro": 1}) == []
    assert _batch("texto") == []
    assert _batch(None) == []


def test_busqueda_normalizada():
    out = _batch([{"event": "search", "path": "/empleos", "search_term": "  Técnico   ELECTRICISTA Ñandú ",
                   "results": 3}])
    assert out[0].search_term == "tecnico electricista nandu"
    assert out[0].results == 3
    largo = _batch([{"event": "search", "path": "/empleos", "search_term": "a" * 500, "results": True}])[0]
    assert len(largo.search_term) == 100
    assert largo.results is None  # un bool no es un número
    assert _batch([{"event": "search", "path": "/empleos", "search_term": 5, "results": -1}])[0].search_term is None
    # search_term en otro evento no se guarda
    assert _batch([{"event": "page_view", "path": "/", "search_term": "x"}])[0].search_term is None


def test_ids_anonimos_validados():
    vid, sid = str(uuid.uuid4()), str(uuid.uuid4())
    ok = _batch([{"event": "page_view", "path": "/", "visitor_id": vid, "session_id": sid}])[0]
    assert (ok.visitor_id, ok.session_id) == (vid, sid)
    malo = _batch([{"event": "page_view", "path": "/", "visitor_id": "juan@mail.com", "session_id": "x" * 500}])[0]
    assert (malo.visitor_id, malo.session_id) == (None, None)


def test_label_de_registro_y_contacto():
    out = _batch([
        {"event": "sign_up", "path": "/onboarding", "method": "Candidato"},
        {"event": "generate_lead", "path": "/contacto", "topic": "empresa"},
        {"event": "sign_up", "path": "/onboarding", "method": "<script>"},
        {"event": "page_view", "path": "/", "method": "candidato"},
    ])
    assert [e.label for e in out] == ["candidato", "empresa", None, None]


def test_origen_del_evento_y_del_header():
    # el referrer del evento manda; si no viene, se usa el header (en un beacon, la propia página)
    a = _batch([{"event": "page_view", "path": "/", "referrer": "https://www.google.com/"}],
               ref="https://bbjobs.com.ar/")[0]
    b = _batch([{"event": "page_view", "path": "/empleos"}], ref="https://bbjobs.com.ar/")[0]
    c = _batch([{"event": "page_view", "path": "/", "referrer": ""}], ref="https://bbjobs.com.ar/")[0]
    assert (a.source, b.source, c.source) == ("google", "interno", "directo")


def test_nada_personal_en_la_fila():
    ev = _batch([{"event": "page_view", "path": "/", "email": "juan@mail.com", "user_id": "u1", "ip": "1.2.3.4",
                  "referrer": "https://www.google.com/search?q=juan"}], ref="https://bbjobs.com.ar/")[0]
    columnas = {c.name for c in ev.__table__.columns}
    assert columnas == {"id", "created_at", "event", "path", "job_id", "search_term", "results", "label",
                        "source", "device", "visitor_id", "session_id"}
    valores = " ".join(str(getattr(ev, c)) for c in columnas)
    for dato in ("juan", "1.2.3.4", "u1", "Chrome", "google.com"):
        assert dato not in valores


def test_periodos_en_hora_de_argentina():
    # 09/10 01:00 UTC = 08/10 22:00 en Argentina: "hoy" todavía es el 8.
    cur, prev = sm.periods(7, datetime(2026, 10, 9, 1, 0, tzinfo=timezone.utc))
    assert cur.first_day == date(2026, 10, 2)
    assert cur.start == datetime(2026, 10, 2, 3, 0, tzinfo=timezone.utc)
    assert cur.end == datetime(2026, 10, 9, 3, 0, tzinfo=timezone.utc)
    assert prev.end == cur.start
    assert prev.start == datetime(2026, 9, 25, 3, 0, tzinfo=timezone.utc)
