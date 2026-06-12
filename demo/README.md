# Demo separado — CRM Hotelero

Este directorio contiene la configuración ligera para ejecutar un demo aislado del CRM sin tocar la versión productiva.

## ¿Por qué un demo separado?

- Para presentar el sistema sin riesgo de mezclar datos reales.
- Para tener un entorno de ventas y demo con datos de ejemplo.
- Para mantener la versión productiva limpia y lista para desplegar cuando tengas pagos, CUIT y servidor real.

## Qué incluye

- `backend.env` — variables de entorno del backend demo
- `frontend.env` — variables de entorno del frontend demo
- `start-demo.ps1` — iniciar backend + frontend demo en Windows
- `start-demo.sh` — iniciar backend + frontend demo en Linux/macOS
- `restore-demo-data.ps1` — restaurar el dataset de ejemplo en la base de datos demo

## Cómo empezar

### 1. Instalar dependencias

```powershell
cd ..\backend
npm install

cd ..\frontend
npm install
```

### 2. Ejecutar el demo

```powershell
cd demo
.\start-demo.ps1
```

Esto abrirá dos terminales:
- Backend demo en `http://localhost:5002`
- Frontend demo en `http://localhost:3002`

### 3. Cargar datos de ejemplo

Para cargar el backup de demo en la base de datos separada:

```powershell
cd demo
.\restore-demo-data.ps1
```

## URLs del demo

- Frontend demo: `http://localhost:3002`
- Backend demo API: `http://localhost:5002/api`
- WebSocket demo: `ws://localhost:5002/ws`

## Notas

- El demo usa una base de datos independiente: `crm-hotelero-demo`
- La versión productiva sigue en `backend/config/.env` y `frontend/.env`
- No necesitas copiar ni clonar el repositorio para tener el demo; solo usa los scripts de esta carpeta.
