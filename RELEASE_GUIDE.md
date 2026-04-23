# 🚀 Guía de Release - Multiservi SaaS POS

Esta guía describe los pasos necesarios para subir una nueva versión del programa a GitHub y generar el instalador oficial.

## 🔑 Requisitos de Seguridad
Para que el proceso sea automático (sin pedir contraseñas), el sistema utiliza el **Token de Acceso Personal (PAT)** guardado en el archivo `.env`.

*   **Token:** Guardado en la variable `GH_TOKEN` del archivo `.env`.
*   **Importante:** Nunca subas el token real a archivos públicos de texto.

---

## 🛠 Paso a Paso para una Nueva Versión

### 1. Actualizar la Versión (Bumping)
Antes de subir nada, hay que cambiar el número de versión en el archivo `package.json` (línea 5).
*   Ejemplo: De `0.1.2` a `0.1.3`.

### 2. Sincronizar con GitHub (Push)
Para subir los cambios usando el Token de seguridad:
1.  Obtén el token del archivo `.env`.
2.  Usa este comando (sustituyendo `TOKEN_AQUI` por el valor real):
```bash
git remote set-url origin https://TOKEN_AQUI@github.com/alberto19963-rgb/multiservi-app.git
git add .
git commit -m "feat: descripción de mejoras"
git push origin main
```

### 3. Generar el Instalador (Release)
Este es el comando que compila el código y crea el instalador `.dmg`:
```bash
npm run release
```

---

## 📝 Notas para Antigravity (AI)
Cada vez que el usuario pida una "Nueva Versión":
1.  **Preguntar** por las mejoras realizadas.
2.  **Modificar** la versión en `package.json`.
3.  **Ejecutar** el `push` usando la URL con el Token de `.env`.
4.  **Confirmar** el envío del comando `npm run release`.

---
*Documento creado el 23 de Abril, 2026.*
