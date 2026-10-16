# Vid Vibe Planner

Crea la base de una aplicacion web en espanol llamada Publi para programar y publicar videos cortos en redes sociales. Solo la base, sin integraciones externas todavia.

Requisitos:
1. Registro e inicio de sesion obligatorios con email y contrasena (Supabase Auth). Todas las rutas excepto login y registro estan protegidas. Sin sesion se redirige a login.
2. Layout con barra lateral y estas paginas vacias pero navegables: Panel, Cola, Subir video, Historial, Cuentas, Ajustes.
3. Panel: tarjetas con contadores (pendientes, publicados, con error) leidos de la base de datos y lista de los proximos 5 videos programados.
4. Subir video: formulario para elegir un archivo mp4, escribir pie de foto, texto de subtitulos y fecha de publicacion. El archivo se sube a un bucket publico de Supabase Storage llamado videos, dentro de una carpeta con el id del usuario, y se guarda su URL publica.
5. Cola: tabla de videos con estado pendiente, publicado o error, con opciones de editar fecha, editar texto y eliminar.
6. Base de datos: tabla videos (id, userId, path, publicUrl, caption, subtitleText, status, scheduledAt, publishedAt, error, createdAt), tabla accounts (id, userId, platform, externalId, createdAt) y tabla settings (userId, intervalHours). Activa seguridad por filas para que cada usuario solo vea y modifique lo suyo.
7. Diseno limpio, sobrio y responsive, con modo oscuro.

Reglas de codigo: cero comentarios, nombres en camelCase abreviando palabras redundantes, mensajes de consola simples sin emoticonos.

No implementes publicacion real en redes, ni ffmpeg, ni funciones programadas: de eso se encargara otra herramienta despues.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/60d13796-f32b-4d74-acf0-ed23a24db979).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
