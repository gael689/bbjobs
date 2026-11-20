"""Genera la pestaña «Agentes de IA» de la vista previa para Eugenia (`/vista-previa/<clave>`).

Sale todo del registro (`app/services/ai/agentes.py`), de las instrucciones (`app/agentes/*.md`)
y de los precios verificados (`app/services/ai/precios.py`). No lee ninguna base ni llama a Gemini:
se puede correr en cualquier momento, y conviene correrlo cada vez que cambia un agente.

Uso (desde backend/):
  .venv\\Scripts\\python.exe scripts\\generar_vista_agentes.py
Escribe frontend/src/vista-previa/datos/agentes.json
"""
from __future__ import annotations

import json
import sys
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.ai import agentes, pipeline, precios  # noqa: E402

SALIDA = Path(__file__).resolve().parents[2] / "frontend" / "src" / "vista-previa" / "datos" / "agentes.json"
DESDE_2027 = date(2027, 1, 2)

EQUIPOS = {
    "recomendaciones": ("Recomendaciones", "Encuentran a los candidatos que encajan con cada búsqueda."),
    "asistentes": ("Asistentes", "Ayudan a empresas y candidatos dentro del portal."),
    "talency": ("Para Talency", "Ayudan al equipo de Talency a moderar y armar campañas."),
}


def main() -> None:
    # El rerank de antes (una llamada que además escribía la cita y los motivos) para comparar.
    antes = float(precios.costo("gemini-3.5-flash-lite", 1400, 600))
    datos = {
        "generado": datetime.now().strftime("%d/%m/%Y"),
        "fuente_precios": precios.FUENTE,
        "equipos": [{"clave": k, "titulo": t, "bajada": b} for k, (t, b) in EQUIPOS.items()],
        "agentes": [
            {
                "clave": a.clave, "nombre": a.nombre, "equipo": a.equipo, "tipo": a.tipo,
                "modelo": agentes.modelo_de(a), "que_hace": a.que_hace, "recibe": a.recibe,
                "devuelve": a.devuelve, "nunca": a.nunca, "codigo": agentes.CODIGO[a.clave],
                "costo_uso": agentes.costo_estimado(a.clave),
                "costo_uso_2027": agentes.costo_estimado(a.clave, DESDE_2027),
                "instrucciones": agentes.instrucciones(a.clave) if a.con_instrucciones else None,
            }
            for a in agentes.AGENTES
        ],
        "recorrido": [{"tipo": t, "valor": v} for t, v in agentes.RECORRIDO],
        "por_busqueda": agentes.costo_por_busqueda(),
        "por_busqueda_2027": agentes.costo_por_busqueda(DESDE_2027),
        "busquedas_por_mes": agentes.BUSQUEDAS_POR_MES,
        "llamadas_por_busqueda": agentes.POR_BUSQUEDA,
        "franja_revisor": [pipeline.REVIEW_MIN, pipeline.REVIEW_MAX],
        "evaluador_antes": round(antes, 6),
        "evaluador_ahora": agentes.costo_estimado("evaluador"),
        "tope_diario": float(pipeline.settings.AI_DAILY_BUDGET_USD),
    }
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Escrito {SALIDA} ({len(datos['agentes'])} agentes, búsqueda ~USD {datos['por_busqueda']:.4f})")


if __name__ == "__main__":
    main()
