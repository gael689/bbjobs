import json

import httpx
import pytest

from app.core.config import settings
from app.integrations import resend_client
from app.integrations.resend_client import EmailSendError, OutgoingEmail


def _mount(monkeypatch, handler):
    """Reemplaza el cliente HTTP por uno con transporte simulado: ningún test toca la red."""
    monkeypatch.setattr(
        resend_client,
        "_make_client",
        lambda: httpx.AsyncClient(
            base_url=resend_client.RESEND_BASE_URL, transport=httpx.MockTransport(handler)
        ),
    )


@pytest.fixture(autouse=True)
def _config(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", "re_test")
    monkeypatch.setattr(settings, "RESEND_FROM_EMAIL", "BBJobs <avisos@bbjobs.com.ar>")
    monkeypatch.setattr(settings, "RESEND_REPLY_TO", None)


def _mail(**kw) -> OutgoingEmail:
    return OutgoingEmail(to="ana@example.com", subject="Hola", html="<p>Hola</p>", **kw)


async def test_send_email_builds_payload_and_returns_id(monkeypatch):
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["auth"] = request.headers["authorization"]
        seen["idem"] = request.headers.get("idempotency-key")
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "msg_1"})

    _mount(monkeypatch, handler)
    msg_id = await resend_client.send_email(
        _mail(
            text="Hola",
            headers={"List-Unsubscribe": "<https://x/baja>"},
            tags={"category": "novedades"},
            idempotency_key="outbox-123",
        )
    )

    assert msg_id == "msg_1"
    assert seen["auth"] == "Bearer re_test"
    assert seen["idem"] == "outbox-123"
    assert seen["body"]["from"] == "BBJobs <avisos@bbjobs.com.ar>"
    assert seen["body"]["to"] == ["ana@example.com"]
    assert seen["body"]["text"] == "Hola"
    assert seen["body"]["headers"] == {"List-Unsubscribe": "<https://x/baja>"}
    assert seen["body"]["tags"] == [{"name": "category", "value": "novedades"}]


async def test_reply_to_falls_back_to_settings(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_REPLY_TO", "hola@bbjobs.com.ar")
    seen = {}

    def handler(request):
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"id": "x"})

    _mount(monkeypatch, handler)
    await resend_client.send_email(_mail())
    assert seen["body"]["reply_to"] == "hola@bbjobs.com.ar"


@pytest.mark.parametrize("status,transient", [(429, True), (500, True), (503, True), (422, False), (403, False)])
async def test_errors_are_classified_transient_or_permanent(monkeypatch, status, transient):
    _mount(monkeypatch, lambda r: httpx.Response(status, json={"message": "nope"}))
    with pytest.raises(EmailSendError) as exc:
        await resend_client.send_email(_mail())
    assert exc.value.transient is transient
    assert exc.value.status_code == status


async def test_network_error_is_transient(monkeypatch):
    def handler(request):
        raise httpx.ConnectTimeout("timeout")

    _mount(monkeypatch, handler)
    with pytest.raises(EmailSendError) as exc:
        await resend_client.send_email(_mail())
    assert exc.value.transient is True


async def test_without_api_key_raises_permanent_error(monkeypatch):
    monkeypatch.setattr(settings, "RESEND_API_KEY", None)
    with pytest.raises(EmailSendError) as exc:
        await resend_client.send_email(_mail())
    assert exc.value.transient is False
    assert resend_client.is_configured() is False


async def test_send_batch_returns_ids_in_order(monkeypatch):
    def handler(request):
        assert request.url.path == "/emails/batch"
        payload = json.loads(request.content)
        assert [p["to"] for p in payload] == [["a@x.com"], ["b@x.com"]]
        return httpx.Response(200, json={"data": [{"id": "1"}, {"id": "2"}]})

    _mount(monkeypatch, handler)
    ids = await resend_client.send_batch(
        [OutgoingEmail(to="a@x.com", subject="s", html="h"), OutgoingEmail(to="b@x.com", subject="s", html="h")]
    )
    assert ids == ["1", "2"]


async def test_send_batch_count_mismatch_is_transient(monkeypatch):
    _mount(monkeypatch, lambda r: httpx.Response(200, json={"data": [{"id": "1"}]}))
    with pytest.raises(EmailSendError) as exc:
        await resend_client.send_batch(
            [OutgoingEmail(to="a@x.com", subject="s", html="h"), OutgoingEmail(to="b@x.com", subject="s", html="h")]
        )
    assert exc.value.transient is True


async def test_send_batch_rejects_oversized_batch():
    too_many = [OutgoingEmail(to=f"{i}@x.com", subject="s", html="h") for i in range(101)]
    with pytest.raises(ValueError):
        await resend_client.send_batch(too_many)


async def test_send_batch_empty_is_noop():
    assert await resend_client.send_batch([]) == []
