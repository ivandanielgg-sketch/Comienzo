# Control de Proyectos

Aplicacion web para registrar proyectos con acceso por usuario y contrasena.
Permite capturar datos comerciales y operativos, registrar pagos, registrar
compras/gastos/salarios relacionados con la cotizacion y calcular totales clave.

## Funcionalidad incluida

- Login con usuario y contrasena.
- Pagina de administracion para agregar y modificar usuarios.
- Eliminacion de proyectos validando la contrasena del usuario activo.
- ID unico de proyecto generado automaticamente por consecutivo.
- Alta y edicion de proyectos con:
  - Numero de cotizacion.
  - Numero de pedido.
  - Numero de orden de compra o marca de "No Aplica".
  - Vendedor, cliente, tecnico responsable y fecha prometida de entrega.
  - Descripcion del proyecto para indicar de que trata.
  - Margen esperado, total facturado con IVA y avance manual.
  - Estado: Pendiente, En Proceso o Terminado.
  - Riesgo: Alto, Medio o Bajo.
  - Observaciones.
- Registro de pagos para sumar el Total Cobrado.
- Registro de costos por tipo: Compra, Gasolina, Casetas, Viaticos, Sueldo,
  Materiales, Hospedaje u Otros.
- Captura de importes en MXN, USD o EUR.
- Panel de tipo de cambio a pesos mexicanos con fecha de ultima actualizacion.
- Calculo automatico de:
  - Pendiente de cobro = Total Facturado - Total Cobrado.
  - Margen Final = 1 - (Gastado / Total Facturado).
- Etiqueta de color para margen final contra margen esperado.
- Exportacion del listado de proyectos y sus gastos relacionados a un archivo `.xls`
  compatible con Excel.

## Requisitos

- Node.js 20 o superior.
- npm.

## Configuracion

Instala dependencias:

```bash
npm install
```

Opcionalmente crea un archivo `.env` para cambiar credenciales y configuracion:

```bash
ADMIN_USER=admin
ADMIN_PASSWORD=admin123
SESSION_SECRET=cambia-este-secreto
PORT=3000
TRUST_PROXY=true
```

Si no defines variables, se crea automaticamente el usuario `admin` con la
contrasena `admin123`.

## Uso

```bash
npm start
```

Abre `http://localhost:3000`.

La base de datos SQLite se guarda en `data/app.db`.

## Publicacion en Render u otro hosting con HTTPS

En Render configura estas variables de entorno:

```bash
NODE_ENV=production
ADMIN_USER=admin
ADMIN_PASSWORD=una-contrasena-segura
SESSION_SECRET=un-texto-largo-y-secreto
TRUST_PROXY=true
```

Render publica la app detras de un proxy HTTPS. `TRUST_PROXY=true` permite que
Express reconozca la conexion segura y mantenga la cookie de sesion despues del
login.

Si usas SQLite en produccion, configura tambien un disco persistente y apunta la
base de datos ahi. En ese mismo archivo se guardan proyectos, usuarios y sesiones:

```bash
DB_PATH=/var/data/app.db
```

Esto evita la advertencia de `connect.session() MemoryStore`, conserva usuarios,
proyectos, tipos de cambio y mantiene la sesion activa aunque el servicio
reinicie, siempre que `/var/data` sea un disco persistente.

### Configurar disco persistente en Render

Para garantizar que usuarios, proyectos, pagos, gastos, tipos de cambio y
sesiones se conserven despues de cada deploy:

1. Entra al servicio web en Render.
2. Abre la seccion **Disks**.
3. Agrega un disco persistente.
4. Usa como mount path:

```bash
/var/data
```

5. En **Environment** agrega o confirma:

```bash
DB_PATH=/var/data/app.db
```

6. Guarda cambios y redeploya el servicio.

No uses `data/app.db` en produccion en Render, porque esa ruta vive dentro del
filesystem temporal del deploy y puede perderse al actualizar la plataforma.

## Pruebas

```bash
npm test
```
