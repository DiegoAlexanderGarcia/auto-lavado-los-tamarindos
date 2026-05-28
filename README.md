# Auto Lavado Los Tamarindos

Aplicacion web para gestionar facturacion de servicios de autolavado, monta llantas y mecanica, con registro de empleados y calculo de comisiones por servicio realizado.

## Requisitos

- Java 17 o superior
- Maven 3.9 o superior

## Ejecutar

```bash
mvn spring-boot:run
```

Luego abre:

```text
http://localhost:8080
```

## Publicar en Netlify

El archivo `netlify.toml` publica la carpeta `src/main/resources/static`, que es donde esta el frontend. En Netlify la app funciona con persistencia local del navegador; para usar la persistencia de Spring Boot debes ejecutarla en un servidor Java.

## Que incluye

- Registro y edicion de empleados con porcentaje de ganancia.
- Registro y edicion de servicios por categoria y precio.
- Creacion de facturas con uno o varios servicios.
- Calculo automatico de total, comision del empleado y neto del negocio.
- Reporte de ganancias acumuladas por empleado.
- Reportes por dia, semana o mes.
- Registro de pagos diarios a empleados.
- Registro de prestamos y abonos para saber cuanto debe cada empleado.
- Historial de facturas recientes.
- Persistencia en `data/tamarindos-db.json`.

## Estructura

- `src/main/java/com/tamarindos/billing`: backend Spring Boot y API REST.
- `src/main/resources/static`: interfaz en HTML, CSS y JavaScript.
- `data`: carpeta donde se guarda la base de datos JSON local.
