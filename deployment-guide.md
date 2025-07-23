# Guía de Despliegue en Azure

## Configuración Previa

### 1. Variables de Entorno Requeridas

En Azure App Service, configura las siguientes variables de entorno:

```
MONGODB_URI=mongodb+srv://admin:admin123@cluster0.r2i9611.mongodb.net/polimusic_db?retryWrites=true&w=majority&appName=Cluster0
NODE_ENV=production
PORT=3000
WEBSITES_PORT=3000
ALLOWED_ORIGINS=*
```

### 2. Configuración de MongoDB Atlas

1. **Whitelist de IPs**: En MongoDB Atlas, ve a Network Access y agrega `0.0.0.0/0` para permitir conexiones desde Azure
2. **Verificar credenciales**: Asegúrate de que el usuario `admin` tenga permisos de lectura/escritura
3. **Probar conexión**: Usa MongoDB Compass o similar para verificar la conexión

## Opciones de Despliegue

### Opción 1: Azure App Service (Recomendado)

1. **Crear App Service**:
   ```bash
   az webapp create \
     --resource-group myResourceGroup \
     --plan myAppServicePlan \
     --name microservice-song \
     --runtime "NODE|18-lts"
   ```

2. **Configurar variables de entorno**:
   ```bash
   az webapp config appsettings set \
     --resource-group myResourceGroup \
     --name microservice-song \
     --settings MONGODB_URI="tu-connection-string" NODE_ENV="production"
   ```

3. **Desplegar código**:
   ```bash
   az webapp deployment source config-zip \
     --resource-group myResourceGroup \
     --name microservice-song \
     --src deployment.zip
   ```

### Opción 2: Azure Container Instances

1. **Construir imagen Docker**:
   ```bash
   docker build -t microservice-song .
   docker tag microservice-song yourregistry.azurecr.io/microservice-song:latest
   docker push yourregistry.azurecr.io/microservice-song:latest
   ```

2. **Crear container instance**:
   ```bash
   az container create \
     --resource-group myResourceGroup \
     --name microservice-song \
     --image yourregistry.azurecr.io/microservice-song:latest \
     --ports 3000 \
     --environment-variables MONGODB_URI="tu-connection-string" NODE_ENV="production"
   ```

### Opción 3: Azure Kubernetes Service (AKS)

1. **Crear deployment.yaml**:
   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: microservice-song
   spec:
     replicas: 2
     selector:
       matchLabels:
         app: microservice-song
     template:
       metadata:
         labels:
           app: microservice-song
       spec:
         containers:
         - name: microservice-song
           image: yourregistry.azurecr.io/microservice-song:latest
           ports:
           - containerPort: 3000
           env:
           - name: MONGODB_URI
             value: "tu-connection-string"
           - name: NODE_ENV
             value: "production"
   ```

## Verificación del Despliegue

1. **Health Check**: `GET https://tu-app.azurewebsites.net/health`
2. **API Test**: `GET https://tu-app.azurewebsites.net/api/songs`

## Monitoreo y Logs

1. **Application Insights**: Configura para monitoreo de rendimiento
2. **Log Stream**: `az webapp log tail --name microservice-song --resource-group myResourceGroup`

## Solución de Problemas Comunes

### Error de Conexión a MongoDB
- Verificar que la IP de Azure esté en la whitelist de MongoDB Atlas
- Comprobar que las credenciales sean correctas
- Revisar el formato del connection string

### Puerto no disponible
- Asegurar que `WEBSITES_PORT=3000` esté configurado
- Verificar que la aplicación escuche en `0.0.0.0` y no solo en `localhost`

### Timeout en el startup
- Aumentar el timeout en `web.config`
- Verificar que las dependencias se instalen correctamente
- Revisar los logs de la aplicación

## Configuración de CI/CD

El archivo `azure-pipelines.yml` incluido proporciona un pipeline completo para:
- Build automático
- Push a Azure Container Registry
- Deploy a Azure App Service

Personaliza las variables según tu configuración específica.