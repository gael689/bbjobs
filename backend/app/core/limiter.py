"""Rate limit (slowapi) por IP real del cliente.

Detrás del proxy de Railway, `request.client.host` es la IP del proxy interno (rango CGNAT
100.64.0.0/10), no la del usuario: con `get_remote_address` a secas, todo el tráfico compartía
una sola cuenta y el límite "por IP" era en realidad global. uvicorn no lo corrige solo: su
`--proxy-headers` sólo confía en 127.0.0.1 por defecto (FORWARDED_ALLOW_IPS).

Qué header es confiable en Railway (investigado el 08/10/2026):
- La doc oficial (docs.railway.com/networking/public-networking/specs-and-limits) dice que el
  edge agrega `X-Real-IP` "para identificar la IP remota del cliente". No menciona
  X-Forwarded-For ni rangos de IP de sus proxies.
- En Help Station, un moderador afirma que el edge **pisa** X-Real-IP y X-Forwarded-For (no los
  concatena), y personal de Railway recomendó usar **el primer valor de X-Forwarded-For**, porque
  desde feb/2026 parte del tráfico pasa por Fastly y en ese camino X-Real-IP llegó a traer la IP
  del CDN en vez de la del usuario. Railway también aclaró que el rango 100.x de sus proxies no
  es estable ni está documentado.
Por eso: primer valor de X-Forwarded-For, después X-Real-IP, y **sólo** si quien nos habla
directamente es una dirección privada/CGNAT/loopback (o sea, un proxy de la plataforma y no
alguien de internet pegándole directo al contenedor). Si no, `request.client.host`.

Límite conocido: si algún día el edge de Railway concatenara en vez de pisar, el primer valor lo
elegiría el cliente y podría esquivar el límite — nunca peor que antes (límite global). No usar
esta IP para nada de seguridad más allá de frenar abuso.
"""
from __future__ import annotations

import ipaddress

from slowapi import Limiter
from starlette.requests import Request

# Redes desde las que aceptamos headers de reenvío: el proxy de Railway (CGNAT 100.64.0.0/10,
# sin rango fijo documentado), redes privadas y loopback (desarrollo, docker).
_TRUSTED_PROXY_NETS = tuple(ipaddress.ip_network(n) for n in (
    "100.64.0.0/10", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "127.0.0.0/8",
    "::1/128", "fc00::/7", "fe80::/10",
))


def _parse_ip(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return str(ipaddress.ip_address(value.strip()))
    except ValueError:
        return None


def _is_trusted_proxy(host: str | None) -> bool:
    ip = _parse_ip(host)
    if ip is None:
        return False
    addr = ipaddress.ip_address(ip)
    return any(addr in net for net in _TRUSTED_PROXY_NETS)


def client_ip(request: Request) -> str:
    """IP del usuario para el rate limit (key_func de slowapi)."""
    peer = request.client.host if request.client else None
    if _is_trusted_proxy(peer):
        xff = request.headers.get("x-forwarded-for")
        if xff:
            first = _parse_ip(xff.split(",")[0])
            if first:
                return first
        real = _parse_ip(request.headers.get("x-real-ip"))
        if real:
            return real
    return peer or "127.0.0.1"


# Instancia compartida — vive fuera de main.py para que los routers puedan importarla sin
# crear un import circular (main.py importa los routers, no al revés).
limiter = Limiter(key_func=client_ip)
