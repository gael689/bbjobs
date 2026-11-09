# Prompt para la próxima sesión (copiar y pegar)

```
BBJobs, rama feat/mails-ia. Dos tareas:

1. Construí "Vieron tu CV" y las notas de la empresa (privadas o visibles para el postulante)
   siguiendo AVISOS-POR-ACCION-Y-NOTAS-PLAN.md (§2, §3 y los pasos del §5). Usá las propuestas
   del §4 salvo que Eugenia haya decidido otra cosa (preguntame antes de arrancar si hubo
   respuesta suya). Todo detrás de la compuerta MODULOS_NUEVOS_ACTIVOS, con tests de cruce entre
   empresas, de que una nota privada nunca llega al candidato, y el borrado de cuenta. Al
   terminar, actualizá AVISOS-AUTOMATICOS-EUGENIA.pdf y VIERON-TU-CV-Y-NOTAS-EUGENIA.pdf
   (de "propuesto" a "construido").

2. Calibrá el orden de los candidatos recomendados. Si Eugenia ya etiquetó búsquedas reales
   (scripts/evaluacion_rag.py exportar / medir), usá eso; si no, revisá con el simulacro por
   qué dos candidatos que cumplen un excluyente cada uno quedan separados por la parte
   semántica (Tomás 53 vs Martín 64 el 04/10, invertido en otra corrida) y proponé el ajuste.

Antes de tocar nada: leé PENDIENTES-BBJOBS.md. Base local: puerto 5544 con pgvector; para
alembic pisá DATABASE_URL **y** MIGRATIONS_DATABASE_URL (el .env apunta a producción).
```
