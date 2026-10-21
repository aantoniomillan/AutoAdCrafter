# Publi

Aplicacion web en espanol para programar y publicar Reels en Instagram. Stack: TanStack Start + React, Supabase propio (Auth, Postgres, Storage, Edge Functions), vitest. Proyecto de Supabase: `kerxeqqnwurkwspzdvub`.

## Como funciona

1. Subes un mp4 en **Subir video** con pie de foto, texto de subtitulos y fecha. Se guarda en el bucket publico `videos` en `<userId>/<uuid>.mp4`.
2. **Subtitulos** (GitHub Actions, `.github/workflows/subtitulos.yml` y `scripts/subtitulos/`): cada 30 minutos coge los videos pendientes con `subtitleText` y `processed = false`, quema el texto con ffmpeg (1080x1920, texto grande centrado abajo), sube el resultado como un archivo nuevo, actualiza `path` y `publicUrl`, guarda el original en `srcPath` y marca `processed = true`. Si editas el texto de subtitulos, un trigger vuelve a poner `processed = false` y se vuelve a quemar desde el original.
3. **Publicacion** (Edge Function `supabase/functions/publicar`, llamada por pg_cron cada 10 minutos): para cada usuario respeta `settings.intervalHours` desde su ultima publicacion, toma el video pendiente mas antiguo cuya `scheduledAt` ya paso y que este procesado o no tenga subtitulos, lo bloquea (`lockedAt`), crea el contenedor de Reel en la API Instagram Graph con `publicUrl`, espera a que termine de procesarse (con limite de intentos) y publica. Si todo va bien marca `publicado` y `publishedAt`; si falla marca `error` con el mensaje y no lo reintenta. Desde **Cola** puedes pulsar **Reintentar**.
4. **Cuentas** guarda el id de Instagram (`externalId`) y muestra el estado de la conexion. Los tokens nunca se guardan en tablas ni en el repositorio: van cifrados en Supabase Vault.

La logica de seleccion es pura y esta en `supabase/functions/publicar/logic.ts`. La usan la funcion, el frontend (fecha estimada de la proxima publicacion) y las pruebas.

## Configuracion del repositorio

- `.env` solo contiene la URL y la clave publishable, que son publicas por diseno. La clave secreta, la contrasena de la base de datos y los tokens de Meta nunca van en el repositorio.
- El cliente web lee `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. El servidor lee `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY`. La funcion `publicar` usa las variables que inyecta Supabase. Los workflows leen secretos de GitHub. No queda ningun valor fijo del proyecto antiguo de Lovable.
- `supabase/migrations/` es la fuente de verdad para `supabase db push`. Se aplican en orden sobre una base vacia:
  1. `20261014000000_publi_base.sql` crea las tablas `videos`, `accounts` y `settings`, activa la seguridad por filas y crea las politicas de storage. Es identica a `drizzle/migrations/0000_publi_base.sql`, la que ya se aplico en Lovable.
  2. `20261016000000_publicacion.sql`:
     - Columnas `processed`, `srcPath` y `lockedAt` en videos, y `status`, `lastError` y `checkedAt` en accounts.
     - Triggers que impiden que un usuario cambie el estado de un video (salvo de error a pendiente) o lo edite y borre mientras se publica.
     - Permisos por columna, funciones de Vault para los tokens y el job `publicar` de pg_cron.
  3. `20261016000100_bucket.sql` crea el bucket publico `videos`, que solo acepta mp4.
- `drizzle/migrations/` queda solo como historial de Lovable. Ahi no se anaden migraciones nuevas, para que Lovable no las aplique sobre su base al sincronizar.
- `bun run test` aplica las tres migraciones en orden sobre un Postgres vacio en memoria (PGlite) con stubs de auth, storage, vault, pg_cron y pg_net. Comprueba el bucket, el job, la seguridad por filas y que no haya nada propio de Lovable. Lo real de Vault, pg_cron y pg_net solo se puede verificar en tu proyecto; para eso esta `supabase db push --dry-run`.

## 1. CLI de Supabase y migraciones (en tu equipo)

Instala la CLI. Elige una de estas opciones:

```sh
mkdir -p ~/.local/bin
curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz -C ~/.local/bin supabase
supabase --version
```

```sh
brew install supabase/tap/supabase
```

Desde la raiz del repositorio:

```sh
supabase login
supabase link --project-ref kerxeqqnwurkwspzdvub
supabase db push --dry-run
supabase db push
```

- `supabase login` abre el navegador para autorizar la CLI.
- `supabase link` te pide la contrasena de la base de datos. No la guardes en ningun archivo.
- `supabase db push --dry-run` muestra que migraciones se aplicarian, sin tocar nada.
- `supabase db push` las aplica.

## 2. Funcion publicar y sus secretos

```sh
cronSecret=$(openssl rand -hex 32)
supabase secrets set DRY_RUN=true CRON_SECRET="$cronSecret" --project-ref kerxeqqnwurkwspzdvub
supabase functions deploy publicar --project-ref kerxeqqnwurkwspzdvub --no-verify-jwt
echo "$cronSecret"
```

Copia el valor que imprime el ultimo comando y guardalo en Vault para pg_cron, desde el SQL Editor de Supabase (https://supabase.com/dashboard/project/kerxeqqnwurkwspzdvub/sql/new):

```sql
select vault.create_secret('https://kerxeqqnwurkwspzdvub.supabase.co/functions/v1/publicar', 'publicarUrl');
select vault.create_secret('VALOR_DE_CRON_SECRET', 'publicarSecret');
```

Despues borra esa consulta del historial del SQL Editor. Mientras falten estos dos secretos, el job de pg_cron no hace nada.

Secretos de la funcion:

| Secreto | Valor |
| --- | --- |
| `CRON_SECRET` | Obligatorio. El mismo valor que `publicarSecret` en Vault. |
| `DRY_RUN` | `true` por defecto: las llamadas del cron se ignoran y solo se simula cuando lo pides. Solo con `false` publica de verdad. |
| `GRAPH_VER` | Opcional, por defecto `v24.0`. |
| `POLL_MS`, `POLL_MAX` | Opcional: espera entre consultas del contenedor (10000 ms) y numero de intentos (12). |
| `TIME_MAX`, `FETCH_MS` | Opcional: tiempo maximo por ejecucion (140000 ms) y timeout por llamada (20000 ms). En plan de pago puedes subir `TIME_MAX` a 380000. |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` los inyecta Supabase en la funcion; no hay que crearlos.

## 3. Autenticacion de Supabase

En Authentication > URL Configuration (https://supabase.com/dashboard/project/kerxeqqnwurkwspzdvub/auth/url-configuration):

- **Site URL**: la URL de Cloudflare Pages, por ejemplo `https://publi.pages.dev`.
- **Redirect URLs**: `https://publi.pages.dev/**` y la URL local que muestre `bun run dev`. El registro manda el enlace de confirmacion a la URL desde la que te registras.

El proveedor Email viene activado y pide confirmar el correo. Si no quieres confirmacion, desactivala en Authentication > Sign In / Providers > Email.

## 4. Secretos de GitHub

Se crean en https://github.com/aantoniomillan/AutoAdCrafter/settings/secrets/actions, con New repository secret. Tambien puedes usar `gh secret set NOMBRE`, que pide el valor sin dejarlo en el historial del shell.

| Secreto | Workflow | Donde se consigue |
| --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` | `supabase.yml` | https://supabase.com/dashboard/account/tokens, con Generate new token. Es un token personal de tu cuenta. |
| `SUPABASE_DB_PASSWORD` | `supabase.yml` | La contrasena que pusiste al crear el proyecto. Si no la recuerdas, restablecela en Project Settings > Database > Reset database password. |
| `SUPABASE_PROJECT_ID` | `supabase.yml` | `kerxeqqnwurkwspzdvub`, la referencia que aparece en Project Settings > General. |
| `SUPABASE_URL` | `subtitulos.yml` | `https://kerxeqqnwurkwspzdvub.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `subtitulos.yml` | En Project Settings > API Keys, una clave secreta `sb_secret_...` (o la `service_role` antigua). Da acceso total: solo debe estar en este secreto. |

Comportamiento de los workflows:

- **`supabase.yml`** se ejecuta en cada push a `main` que cambie `supabase/` y tambien a mano desde Actions. Pasa las pruebas, enlaza el proyecto, muestra las migraciones pendientes, ejecuta `supabase db push` y despliega `publicar`.
- **`subtitulos.yml`** se ejecuta cada 30 minutos y a mano.

Los dos terminan con un aviso, sin hacer nada, mientras falten sus secretos. Cuando crees los secretos de `supabase.yml`, el siguiente push a `main` que toque `supabase/` aplicara las migraciones en tu proyecto.

## 5. Web en Cloudflare Pages

1. En https://dash.cloudflare.com, ve a Workers & Pages > Create > Pages > Connect to Git y elige `aantoniomillan/AutoAdCrafter`, rama de produccion `main`.
2. Configuracion de build:
   - Framework preset: None.
   - Build command: `bun install --frozen-lockfile && bun run build`.
   - Build output directory: `dist`.
3. Variables de entorno, en Production y Preview:

   | Variable | Valor |
   | --- | --- |
   | `BUN_VERSION` | `1.4.3` |
   | `NODE_VERSION` | `22` |
   | `VITE_SUPABASE_URL` | `https://kerxeqqnwurkwspzdvub.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_dA6YzjJ1RXYjY8BmcsJelQ_2CqwPSSi` |
   | `VITE_SUPABASE_PROJECT_ID` | `kerxeqqnwurkwspzdvub` |
   | `SUPABASE_URL` | `https://kerxeqqnwurkwspzdvub.supabase.co` |
   | `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_dA6YzjJ1RXYjY8BmcsJelQ_2CqwPSSi` |

   Las `VITE_` se usan al compilar el cliente. Las otras dos las lee el servidor en tiempo de ejecucion. Ninguna es secreta; no anadas la clave secreta a Cloudflare.
4. En Settings > Runtime, anade el compatibility flag `nodejs_compat` y pon una compatibility date de 2025-04-01 o posterior, para que el servidor lea `process.env`. Tras cambiarlo, vuelve a desplegar.
5. Cloudflare define `CF_PAGES=1` durante la build. Con eso nitro genera la salida para Pages en `dist/`: `_worker.js`, `_routes.json` y los estaticos. Lo he comprobado con una build local.
6. Pon la URL `*.pages.dev`, o tu dominio, en la configuracion de autenticacion del paso 3.

Cada push a `main` despliega produccion; las demas ramas generan previews.

## 6. Instagram: cuenta, pagina, app de Meta y token

### Cuenta profesional

En la app de Instagram ve a Configuracion, luego Tipo de cuenta y herramientas, y cambia a cuenta profesional (Empresa o Creador). La API de publicacion no funciona con cuentas personales.

### Pagina de Facebook vinculada

1. Crea una pagina de Facebook, o usa una tuya.
2. En la configuracion de la pagina (o en Meta Business Suite), ve a Cuentas vinculadas y conecta la cuenta de Instagram.
3. Tu usuario de Facebook debe tener control total sobre la pagina.

### App de Meta

1. Entra en https://developers.facebook.com, abre Mis apps y crea una app de tipo Empresa (Business).
2. Anade el producto Instagram con la opcion "API setup with Facebook login". Es la API Instagram Graph con inicio de sesion de Facebook.
3. Permisos necesarios:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`
   - `pages_read_engagement`
   - `business_management`, si la pagina esta en un portfolio empresarial.
4. En modo desarrollo funciona sin revision de Meta para los usuarios con rol en la app (administrador, desarrollador o tester). Basta con que tu seas administrador.
5. Apunta el App ID y el App Secret, en Configuracion > Basica. El App Secret no se guarda en ningun sitio del proyecto.

### Token de pagina derivado de uno de larga duracion

1. En el Graph API Explorer (https://developers.facebook.com/tools/explorer), elige tu app, genera un token de usuario con los permisos anteriores y autoriza la pagina y la cuenta de Instagram. Este token dura una hora.
2. Cambialo por uno de larga duracion (unos 60 dias):

   ```sh
   curl -s "https://graph.facebook.com/v24.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=TOKEN_CORTO"
   ```

3. Con el token largo, pide los tokens de tus paginas. El `access_token` de la pagina, derivado de un token largo, no caduca por tiempo:

   ```sh
   curl -s "https://graph.facebook.com/v24.0/me/accounts?fields=id,name,access_token&access_token=TOKEN_LARGO"
   ```

4. Saca el id de la cuenta de Instagram, que es el `externalId`:

   ```sh
   curl -s "https://graph.facebook.com/v24.0/PAGE_ID?fields=instagram_business_account&access_token=TOKEN_PAGINA"
   ```

5. Opcional: comprueba en https://developers.facebook.com/tools/debug/accesstoken que el token de pagina indica "Caduca: nunca".

No pegues estos tokens en el chat, en issues ni en archivos del repositorio.

### Registrar la cuenta en Publi y guardar el token en Vault

1. En Publi, ve a **Cuentas** y guarda el id de Instagram.
2. En el SQL Editor, obten el id de la fila:

   ```sql
   select id from public.accounts where "externalId" = 'ID_INSTAGRAM';
   ```

3. Guarda el token cifrado:

   ```sql
   select public."setIgToken"('ID_DE_LA_FILA', 'TOKEN_PAGINA');
   ```

4. Borra la consulta del historial.

En **Cuentas** debe aparecer "Token configurado: Si". Para rotar el token, repite la misma llamada. Si borras la cuenta, borra tambien su secreto:

```sql
delete from vault.secrets where name = 'ig_ID_DE_LA_FILA';
```

## 7. Como probar con dryRun

1. **Subtitulos sin cambios**: en GitHub, ve a Actions > Subtitulos > Run workflow, marca `dryRun` y lanza. Descarga y quema los videos, pero no sube nada ni toca la base.
2. **Subtitulos de verdad**: lanza sin `dryRun` y comprueba en **Cola** que el video deja de mostrar "Esperando subtitulos".
3. **Publicacion simulada**: con `DRY_RUN=true`, las llamadas del cron se ignoran. Para simular, llama a la funcion pidiendolo de forma explicita:

   ```sh
   curl -s -X POST "https://kerxeqqnwurkwspzdvub.supabase.co/functions/v1/publicar" \
     -H "Content-Type: application/json" \
     -H "x-cron-secret: VALOR_DE_CRON_SECRET" \
     -d '{"dryRun": true}'
   ```

   La simulacion:
   - Selecciona el video y verifica la cuenta.
   - Crea el contenedor en Instagram, que nunca se publica ni es visible y caduca solo.
   - Espera a que termine de procesarse.
   - Devuelve `"result": "simulado"` y deja el video en pendiente.

   La cuenta pasara a "Conectada". Si algo falla, el video queda en error con el motivo y puedes pulsar **Reintentar**. Para que haya algo que seleccionar, el video debe tener la fecha ya pasada y no puede haber otra publicacion tuya dentro del intervalo de **Ajustes**.
4. **Publicar de verdad**: cuando quieras, ejecuta:

   ```sh
   supabase secrets set DRY_RUN=false --project-ref kerxeqqnwurkwspzdvub
   ```

   Desde ese momento, el cron publicara cada 10 minutos lo que toque. Para volver al modo prueba, vuelve a poner `DRY_RUN=true`. Aun con `DRY_RUN=false`, enviar `{"dryRun": true}` sigue forzando la simulacion.
5. **Revisar el cron**:

   ```sql
   select * from cron.job where jobname = 'publicar';
   select * from cron.job_run_details order by start_time desc limit 10;
   select * from net._http_response order by created desc limit 10;
   ```

## Videos automaticos

La carpeta `video/` es un proyecto aparte (Remotion, con su propio `package.json`) que genera Reels de producto de 12 s, 1080x1920 a 30 fps y sin audio, para UtilsLA. El workflow `.github/workflows/reels.yml` los renderiza en GitHub Actions y no toca la app.

Para encolar un video, crea `video/cola/<id>.json` y haz push a `main`:

```json
{
  "titulo": "Proyector de aurora boreal",
  "subtitulo": "Tu habitacion, otro cielo",
  "precio": "29,95 €",
  "precioAntes": "39,95 €",
  "imagenes": ["https://.../foto1.jpg", "https://.../foto2.jpg"],
  "puntos": ["16 colores y 4 efectos", "Recargable por USB-C", "Con mando a distancia"],
  "cta": "Consiguelo en la coleccion Halloween",
  "tema": "halloween"
}
```

- `id` es el nombre del archivo: solo minusculas, numeros, guion y guion bajo. `precioAntes` es opcional. `tema` puede ser `halloween`, `navidad` o `neutro`. Las imagenes deben ser URL https; las que no se descarguen se omiten, y sin ninguna valida el trabajo falla.
- El workflow renderiza cada trabajo que no tenga `video/salida/<id>.json`, sube el mp4 como asset de la release `reels` (la crea si no existe) y hace commit de `video/salida/<id>.json` con `{id, url, fecha, segundos}`. Los mp4 no se commitean.
- Para volver a generar un video, borra su `video/salida/<id>.json` (o cambia el id) y haz push. Tambien se puede lanzar a mano desde Actions > Reels > Run workflow.
- La `url` de salida es publica solo si el repositorio es publico; con un repositorio privado Instagram no podra descargarla.
- En local: `cd video && npm install && npx remotion studio src/index.ts` para previsualizar, y `BROWSER_EXECUTABLE=/ruta/a/chrome node render.mjs --local <id>` para renderizar sin subir nada (el mp4 queda en `video/out/`).

## Desarrollo y pruebas

```sh
bun install
bun run dev
bun run test
node --test scripts/subtitulos/*.test.mjs
```

## Limitaciones conocidas

- Instagram limita las publicaciones por API a unas pocas decenas al dia por cuenta. Ademas, exige que el video cumpla sus requisitos de Reels: H.264 y AAC, 9:16 recomendado, y duracion y tamano dentro de los limites actuales de Meta. Los videos que pasan por subtitulos ya salen en ese formato.
- El limite de subida lo marca el plan de Supabase: 50 MB por archivo en el plan gratuito.
- Con el limite por defecto de Edge Functions (unos 150 s), cada ejecucion publica como mucho un video. El resto queda como `aplazado` para la siguiente ejecucion.
- El quemado de subtitulos reparte el texto en bloques de duracion uniforme. No es una transcripcion sincronizada con la voz.
- El repositorio sigue conectado a Lovable: cada push a `main` aparece en su editor. No reescribas el historial ya publicado.
