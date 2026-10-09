from slowapi import Limiter
from slowapi.util import get_remote_address

# Instancia compartida — vive fuera de main.py para que los routers puedan importarla sin
# crear un import circular (main.py importa los routers, no al revés).
limiter = Limiter(key_func=get_remote_address)
