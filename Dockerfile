# ==========================================
# Etapa 1: Compilación (Build Stage)
# ==========================================
FROM node:20-alpine AS build

WORKDIR /usr/src/app

# Copiar manifiestos de dependencias
COPY package*.json ./

# Instalar TODAS las dependencias (incluidas devDependencies para compilar TS)
RUN npm ci

# Copiar el código fuente y la configuración de TS
COPY tsconfig.json ./
COPY src/ ./src

# Compilar código de TypeScript a JavaScript de producción (genera la carpeta /dist)
RUN npm run build


# ==========================================
# Etapa 2: Ejecución de Producción (Runner Stage)
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Declarar variable de entorno de producción
ENV NODE_ENV=production

# Copiar manifiestos de dependencias para instalar solo las de producción
COPY package*.json ./

# Instalar UNICAMENTE las dependencias de producción para optimizar peso y seguridad
RUN npm ci --only=production

# Copiar únicamente los archivos compilados de la etapa anterior
COPY --from=build /usr/src/app/dist ./dist

# Exponer el puerto estandarizado del BFF (definido en README.md)
EXPOSE 4040

# Regla de Seguridad DevOps: Ejecutar la aplicación con un usuario sin privilegios root
USER node

# Comando de arranque del Gateway
CMD ["node", "dist/index.js"]
