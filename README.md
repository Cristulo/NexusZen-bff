# 🌐 NexusZen BFF (Backend For Frontend) / API Gateway

Este microservicio actúa como la puerta de entrada única y principal para todas las peticiones provenientes del Frontend. Su función es recibir, validar, y enrutar el tráfico hacia los distintos microservicios de dominio (como la API de Facultad o Autenticación).

## 🚀 Stack Tecnológico

*   **Node.js & TypeScript**: Entorno de ejecución y lenguaje.
*   **Fastify**: Framework web ultrarrápido, elegido por su bajísima sobrecarga y alto rendimiento en operaciones de red.
*   **@fastify/http-proxy**: Módulo oficial utilizado para realizar el proxy reverso hacia los microservicios Java internos de forma eficiente.
*   **Pino**: Sistema de logging extremadamente veloz.

## ⚙️ Arquitectura de Red

El BFF se ejecuta en el puerto **`4040`**.
Recibe las peticiones del frontend (usualmente a través del Proxy de Nginx) con el prefijo `/api/v1/...` y se encarga de reescribir la URL y enviarla al servicio Java correspondiente. Por ejemplo, enruta `/api/v1/facultad/*` hacia la API de Facultad.

## 🛠️ Comandos de Desarrollo Local

Si deseas probar el BFF por fuera de Docker:

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Iniciar en modo desarrollo (con recarga automática y logs legibles):
   ```bash
   npm run dev
   ```
3. Compilar TypeScript:
   ```bash
   npm run build
   ```
