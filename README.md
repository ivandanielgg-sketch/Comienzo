# Control de Proyectos

Aplicacion web para registrar proyectos con acceso por usuario y contrasena.
Permite capturar datos comerciales y operativos, registrar pagos, registrar
compras/gastos/salarios relacionados con la cotizacion y calcular totales clave.

## Funcionalidad incluida

- Login con usuario y contrasena.
- ID unico de proyecto generado automaticamente por consecutivo.
- Alta y edicion de proyectos con:
  - Numero de cotizacion.
  - Numero de pedido.
  - Numero de orden de compra o marca de "No Aplica".
  - Vendedor, cliente, tecnico responsable y fecha prometida de entrega.
  - Margen esperado, total facturado con IVA y avance manual.
  - Estado: Pendiente, En Proceso o Terminado.
  - Riesgo: Alto, Medio o Bajo.
  - Observaciones.
- Registro de pagos para sumar el Total Cobrado.
- Registro de Compra, Gasto o Salario para sumar el Gastado.
- Calculo automatico de:
  - Pendiente de cobro = Total Facturado - Total Cobrado.
  - Margen Final = 1 - (Gastado / Total Facturado).

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
```

Si no defines variables, se crea automaticamente el usuario `admin` con la
contrasena `admin123`.

## Uso

```bash
npm start
```

Abre `http://localhost:3000`.

La base de datos SQLite se guarda en `data/app.db`.

## Pruebas

```bash
npm test
```
