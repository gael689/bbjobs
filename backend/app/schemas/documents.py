from pydantic import BaseModel


class SignedDocumentLink(BaseModel):
    """Link de vida corta a un PDF privado (CV de un candidato, documentación de verificación
    de una empresa).

    Se devuelve como JSON en vez de redirigir con un 302 porque el frontend habla con la API
    por axios con el token de Clerk en el header: un `<a href>` apuntando a un endpoint
    autenticado no llevaría ese token y daría 401. El flujo real es pedir el link y recién
    después abrirlo en una pestaña nueva.
    """
    url: str
