# Security remediation report

Дата: 2026-10-25. Обхватът е локалният код. Одитният commit `2052d9d` не е обект в това хранилище, затова всяка находка е проверена срещу текущия източник преди промяна. Оригиналните одитни доклади не са редактирани. Няма commit, push или production deployment.

Проверките срещу PostgreSQL са върху еднократен контейнер `postgres:16-alpine`, публикуван само на `127.0.0.1:55432` и спрян след тестовете. Един ранен `applySchema` без зададен test URL опита `localhost:5432/rent_a_car` и спря с `ECONNREFUSED`, преди да изпълни SQL.

## Обобщение

| Finding | Статус |
| --- | --- |
| SEC-001 | FIXED |
| SEC-002 | FIXED |
| SEC-003 | FIXED |
| SEC-004 | FIXED |
| SEC-005 | FIXED |
| SEC-006 | FIXED |
| SEC-007 | PARTIALLY FIXED |
| SEC-008 | FIXED |
| SEC-009 | FIXED |
| SEC-010 | FIXED |
| SEC-011 | FIXED |
| SEC-012 | FIXED |
| SEC-013 | FIXED |

Критични находки нямаше. Приложимите High/Medium проблеми са поправени в кода. SEC-007 е проверена на изолиран Grafana 13.2.4; production volume и digest pin в deploy остават. Подробностите са в последващата секция.

## SEC-013 — повторният schema seed връща отнети RBAC права

Статус: **FIXED**

Приложимост: `docker-entrypoint` пускаше `db:setup` при всеки API/worker start. `sql/schema/027_rbac.sql` вмъкваше `can_view_reservations_ops` за `driver` с `ON CONFLICT DO NOTHING`, а migration `024` го трие само веднъж. Потвърдено в текущия код преди промяната.

Поправка:

- Fresh schema се прилага само когато `schema_migrations` липсва или е празна. Съществуваща база не преиграва `sql/schema`.
- Driver grant е махнат от schema `027`.
- Нова migration `036_driver_ops_permission_reconcile.sql` трие grant-а и driver сесиите. Migration `024` не е редактирана.
- Worker compose задава `SKIP_DB_SETUP=true` и няма `MIGRATION_DATABASE_URL`. Entrypoint при този флаг маха migration URL преди процеса.

Файлове: `backend/sql/applySchema.js`, `backend/sql/schema/027_rbac.sql`, `backend/migrations/036_driver_ops_permission_reconcile.sql`, `backend/docker-entrypoint.sh`, `docker-compose.aws.yml`, `docker-compose.prod.yml`.

Тестове: `backend/tests/sql/schemaBootstrap.test.js`. Изолиран Postgres:

- Fresh `db:setup`: driver grant count `0`.
- Повторен setup: schema seed е пропуснат, всички 36 migrations са skip, grant остава `0`.
- След ръчно връщане на grant и driver session и изтриване само на ledger реда за `036`, повторният migrate прилага `036` и оставя grants `0`, sessions `0`.

Остава: при deploy API трябва да стартира преди worker, за да мине `036` веднъж. Нова DDL за вече мигрирала база трябва да е migration, не промяна само в `sql/schema`.

## SEC-001 — неограничена rental pricing работа

Статус: **FIXED**

Приложимост: `validateBookingDates` нямаше таван. Тежкият път е `listChargeDates` (по една дата на ден). Search, orders, reservations, checkout и admin pricing/availability минават през същия validator.

Поправка:

- Максимум 366 таксувани дни, проверен преди цикъла в `listChargeDates`. Няма продуктов таван за колко рано може да е pickup. Временният хоризонт от 2000 дни е премахнат в последващата проверка, защото няма основание в UI, API или документацията. Кратко наемане години напред остава валидно. Патологичен период до `9999-12-31` се отхвърля от тавана за дължина.
- Search връща 422 преди repository/pricing, когато прозорецът е невалиден. Частичната цена в order се смята само ако прозорецът е в лимита.
- `searchLimiter`: 120 заявки / 15 минути по подразбиране (`RATE_LIMIT_SEARCH_MAX`). Това е допълнителен контрол, не замяна на тавана.

Файлове: `backend/src/utils/date/rentalLimits.js`, `parseBookingDateTime.js`, `bookingValidation.js`, `seasonalWeekendAdjustments.js`, `carController.js`, `orderController.js`, `rateLimit.js`, `carRoutes.js`.

Тестове: `backend/tests/unit/rentalLimits.test.js`, `backend/tests/api/searchRentalLimit.test.js` (`/api` и `/api/v1`, pricing не се вика). След корекцията на хоризонта `cars.test.js` и admin availability минават.

## SEC-002 — публичният chat връща вътрешни fleet полета

Статус: **FIXED**

Приложимост: `listCarsByFilter` и car details за chat използваха пълния `mapSqlCar` (`vin`, регистрация, пробег, локация, застраховка, статус).

Поправка: allowlist `pickPublicCarFields` в mapper-а, във filter query-то и в controller-а, така че и leaky repository резултат се орязва. Admin пътищата остават с пълния запис. Summary агрегатът не връща тези полета.

Файлове: `carMapper.js`, `carSearchQuery.js`, `supportController.js`.

Тестове: `backend/tests/api/chat.test.js` за `/api` и `/api/v1` cars-by-filter и car-details. Отговорът няма вътрешните полета и низът `SECRET`.

## SEC-003 — SSE заобикаля reservation RBAC и object scope

Статус: **FIXED**

Приложимост: hub-ът приемаше всеки staff абонат и пускаше replay от пръстена без проверка на събитието.

Поправка: `authorizeLiveEvent` / `redactLiveEvent` за live и replay. Reservation/payment събития изискват owner или `can_view_reservations_ops`. Calendar събитие за пълен календар е позволено, но customer данните се махат. Own-tasks получава събитие само когато `assignedToUserId` съвпада. Иначе отказ. Липсващ достъп не получава събитието.

Поведенческа промяна: accountant/support без `can_view_reservations_ops` вече не виждат reservation/payment SSE. Собствените calendar tasks не получават fleet събития, ако emit-ът няма assignee.

Файлове: `realtime.accessPolicy.js`, `realtime.hub.js`, `realtime.controller.js`.

Тестове: `backend/tests/modules/realtime.authorization.test.js`, обновен `realtime.hub.test.js` (абонатите вече подават валиден staff достъп; това е новият договор).

## SEC-004 — отворен SSE преживява logout, expiry и revocation

Статус: **FIXED**

Приложимост: logout правеше само `session.destroy` и не затваряше потоците. Hub-ът нямаше session идентичност.

Поправка:

- Logout вика `revokeSession` и `revokeUser` преди destroy.
- `destroySessionsForUser` / `destroySessionsForRole` затварят in-process абонатите.
- Heartbeat (20s) препроверява живота и session lookup. Липсващ, изтекъл или не-logged-in ред затваря потока. Промяна на ролите/правата също.
- Максимален живот на потока: 15 минути.
- Няма нов Redis. Друг процес вижда revocation на следващия heartbeat, не мигновено.

Файлове: `realtime.hub.js`, `realtime.sessionLookup.js`, `authController.js`, `sessionSqlService.js`, `server.js`.

Тестове: authorization тестът покрива revoke, максимален живот, смяна на достъпа и невалиден lookup за двама абонати. Lookup-ът в теста е инжектиран; няма отделен тест срещу живата `session` таблица.

## SEC-005 — отхвърлен multipart оставя temp файлове

Статус: **FIXED**

Приложимост: multer пишеше в `uploads/tmp` преди field validation. 422 не триеше файла. Worker cleanup не вижда API temp директорията.

Поправка: cleanup middleware е преди multer за customer, admin private, checklist, car image и damage веригите. Файлът се трие при status >= 400 и при прекъсната връзка, само ако пътят е вътре в temp директорията. `validateRequest` също го трие преди 422. Квота 200 temp файла. API janitor на 5 минути, max age 15 минути, само когато background jobs не вървят в същия процес. Temp директорията не се споделя с worker-а.

Файлове: `cleanupTempUploads.js`, `privateUpload.js`, `adminCarUpload.js`, `upload.js`, `uploadUtils.js`, `validateRequest.js`, `imageCleanupService.js`, `server.js`.

Тестове: `tempUploadCleanup.test.js` (чужд път остава; abort маха temp файла) и `accountUploadCleanup.test.js` (невалиден `docType` и невалиден `reservationId` на `/api` и `/api/v1` не оставят нов temp файл).

## SEC-006 — HTML email injection

Статус: **FIXED**

Приложимост: notification sender слагаше summary, reason и имена директно в HTML.

Поправка: `escapeHtml` за HTML текста. `escapeMailHeader` маха CR/LF от subject. Plain text остава неescaped. Maintenance reason и paid-alert email не влизат в HTML.

Файлове: `backend/src/utils/htmlEscape.js`, `notifications.sender.js`.

Тестове: `notificationHtml.test.js` за всеки тип, включително непознат. HTML съдържа `&lt;b&gt;` и няма жив таг; text пази `<b>injected</b>`.

## SEC-007 — Grafana 11.4.0 / CVE-2025-4123

Статус: **PARTIALLY FIXED**

Приложимост: `docker-compose.dev.yml`, `docker-compose.prod.yml` и `docker-compose.aws.yml` сочеха `grafana/grafana:11.4.0`.

Поправка: и трите файла сочат `grafana/grafana:13.2.4`. Loopback bind и `GF_USERS_ALLOW_SIGN_UP=false` са запазени. Dev compose публикува `127.0.0.1:3001:3000`. И трите compose файла задават `GF_SECURITY_CONTENT_SECURITY_POLICY=true`.

Изолираният процес, digest, CSP, datasource и dashboards са проверени в последващата секция. Съществуващ `grafana.db` от 11.4 не е мигриран. Production не е пипан.

## SEC-008 — runtime използва bootstrap superuser

Статус: **FIXED** в кода и на изолирана нова база. Production volume не е проверяван.

Приложимост: compose `DATABASE_URL` използваше `POSTGRES_USER` (`luxride`) и за API, и за worker.

Поправка:

- Runtime роля `luxride_app`: `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`.
- Паролата минава през `quote_literal`, минимум 16 символа, не се логва.
- DML върху таблици и sequences; `REVOKE` на writes върху `schema_migrations`; `REVOKE CREATE` върху `public`; default privileges за следващи таблици.
- API compose: runtime URL плюс `MIGRATION_DATABASE_URL` за setup. Worker: само runtime URL, `SKIP_DB_SETUP=true`, `depends_on` backend healthy.
- `connect-pg-simple` не създава таблица. Session таблицата идва от schema `005`. Ако я няма, restricted ролята не прави DDL.
- Локален `npm run dev` без тези променливи не сменя връзката.

Файлове: `backend/sql/ensureRuntimeRole.js`, `docker-entrypoint.sh`, `server.js`, `docker-compose.aws.yml`, `docker-compose.prod.yml`, `backend/.env.example`.

Изолирана база: `rolsuper/rolcreatedb/rolcreaterole` са false. Като `luxride_app`: `SELECT` върху `roles` минава; `CREATE TABLE` и `INSERT` в `schema_migrations` връщат `42501`.

Остава при deploy: задай `APP_DB_PASSWORD` (поне 16 знака, URL-encoded в URL-а). Първият API start създава ролята като superuser. Worker не трябва да получава migration URL. Съществуващ volume не е минавал през тази проверка.

## SEC-009 — Vite 8.1.2 и @vitest/mocker 4.1.11

Статус: **FIXED** за посочените пакети.

Приложимост: и двата lockfile-а фиксираха vite `8.1.2` и `@vitest/mocker` `4.1.11`.

Поправка: и двата frontend-а са на vite `8.3.5`, vitest `4.1.12`, `@vitest/coverage-v8` `4.1.12`. Mocker в lockfile е `4.1.12`. Няма преход към Vitest 5. Admin Vite `server`/`preview` host е `127.0.0.1`. Dev compose публикува `127.0.0.1:5173` и `127.0.0.1:5174`. Dockerfile.dev слуша `0.0.0.0` вътре в контейнера, за да работи port publish; коментарът го казва.

След upgrade `npm audit` не сочи Vite или mocker. Останалите тогава `undici` и `zod` advisories са затворени в последващата секция.

Проверки: admin lint, typecheck, 204 теста и production build с Vite 8.3.5 минават. Customer lint и typecheck минават; пълният Vitest под паралелно натоварване има 2 timeout-а, които сами минават (13 теста). Customer production build минава.

## SEC-010 — `workflow_dispatch` image tag влиза в shell преди валидация

Статус: **FIXED**

Приложимост: `deploy.yml` слагаше `${{ inputs.image_tag }}` в `run` скрипт преди hex проверката.

Поправка: стойността влиза като env `INPUT_IMAGE_TAG`. `ops/resolve-image-tag.js` печата tag само ако е 40 hex символа. `gh` ползва shell променливи. Няма `${{ }}` в този `run` скрипт.

Тест: `deploymentContracts.test.js`. `$(printf pwned)` излиза с код 1 и не се появява в stdout. Валиден sha се отпечатва непроменен.

## SEC-011 — mutable action tags

Статус: **FIXED** в workflow файловете.

`ci.yml`, `deploy.yml` и `aws-oidc-test.yml` ползват пълни SHA с коментар за tag версията:

- `actions/checkout` `11d5960a326750d5838078e36cf38b85af677262`
- `actions/setup-node` `49933ea5288caeca8642d1e84afbd3f7d6820020`
- `actions/upload-artifact` `ea165f8d65b6e75b540449e92b4886f43607fa02`
- `aws-actions/configure-aws-credentials` `7474bc4690e29a8392af63c5b98e7449536d5c3a`
- `aws-actions/amazon-ecr-login` `03f1aad4c6c7ffd436567f42f9384779290529bd`
- `gitleaks/gitleaks-action` `ff98106e4c7b2bc287b24eaf42907196329070c7`

Тестът изисква всеки `uses:` да завършва с 40 hex символа. Последващата проверка сравни SHA-тата с официалните tag обекти в GitHub API. Резултатът е в секцията за последващата работа.

## SEC-012 — CSV formula injection

Статус: **FIXED**

Приложимост: `toCsv` квотираше запетая и кавичка, без да неутрализира formula-leading текст.

Поправка: текстови клетки с водещи whitespace/control и после `=`, `+`, `-` или `@` получават водещ апостроф. Числовите колони, включително отрицателни, остават числа.

Файлове: `analytics.service.js`.

Тестове: `analyticsCsv.test.js` за `=`, `+`, `@`, интервали, кавички, CR/LF и отрицателен revenue.

## Проверки

| Проверка | Резултат |
| --- | --- |
| Backend ESLint | Мина. 0 грешки. Остават предишни warnings в несвързани файлове. |
| Backend Jest `npm test` | Мина: 871 passed, 17 skipped, 0 failed. Пропуснатите 17 са DB consistency без `RUN_DB_TESTS`. |
| DB consistency | Мина на изолирана база: 17 passed. |
| Integration | Първи ход: 64 passed, 13 failed. И 13-те са `reservationRefund` `beforeAll` timeout 5s. Изолиран повторен ход: 13 passed. |
| Customer lint + typecheck | Минаха. |
| Customer Vitest | Под паралелно натоварване 181 passed, 2 timeout-а (`SearchForm`, `StaticPages`). Изолирано: 13 passed. |
| Customer production build | Мина, Vite 8.3.5. |
| Admin lint, typecheck, Vitest, build | Минаха: 204 теста, Vite 8.3.5 build. |
| Frontend `npm audit` | Няма Vite/mocker advisory. Тогава остават high `undici` и `zod`; затворени са в последващата секция. |
| Backend `npm audit` | Тогава high `body-parser`, high `multer`, moderate `nodemailer`. Затворени са в последващата секция. |
| Playwright E2E | Не е пускан в първия ход. |
| Grafana процес | Не е пускан в първия ход. |

Първият пълен backend Jest, преди хоризонтът да стане 2000 дни, имаше 5 неуспеха: search и admin availability връщаха 422 за дати през 2030, плюс два timeout-а под натоварване. След корекцията целевите файлове и пълният suite минават. Няма останала регресия от тези промени в пуснатите suites.

## Последваща проверка

Дата: 2026-10-25. Източникът е локалният код след първия remediation ход. Няма commit, push, merge или production deployment. Пароли и connection strings не са печатани. Контейнерът `luxride-sec-remediation` е спрян след проверките.

Средата е Windows, Node `v24.22.1`, Docker Desktop. PostgreSQL е `postgres:16-alpine`, публикуван само на `127.0.0.1:55432`. Преди schema, migrate и seed целта е потвърдена: host `127.0.0.1`, port `55432`, база `luxride` за lifecycle и отделна `luxride_test` за DB, integration и Playwright. `.env.test` сочи `localhost:5432/luxride_test` и не е използван.

### Dependency advisories

`npm audit` след обновяването: backend `0` (включително `--omit=dev`), customer frontend `0`, admin frontend `0`. Няма `npm audit fix --force`, няма свалени CI прагове и няма нови ignore правила.

| Пакет | Верига | Обхват | Приложимост | Версия |
| --- | --- | --- | --- | --- |
| body-parser | `express@5.3.0` → `body-parser@2.4.0` | production | Да. `server.js` вика `bodyParser.json()`, а уязвимите версии inflate-ват gzip/deflate по подразбиране (GHSA-27r3-jxmh-p828, `<2.4.0`). | `2.4.0` |
| multer | директна зависимост | production | Да. Upload веригите ползват `fileFilter` (GHSA-q7qp-rjg7-q26m, `<2.5.0`). | `2.5.0` |
| nodemailer | директна зависимост | production | Да. `sendMail` парсва `to`, а получателят може да е потребителски (moderate, AC:H, `<10.1.4`). | `10.2.1` |
| undici | `jsdom@28.1.0` → `undici@7.30.1` | development | Не е в production Nginx образа и не обслужва booking API. Уязвимият клиент е jsdom/test fetch. Поправената линия в range-а на jsdom е 7.30.1; undici 8 е извън този range. | `7.30.1` |
| zod | `eslint-plugin-react-hooks@7.1.1` → `zod@4.6.7` | development | Само lint. Не валидира API заявки. | `4.6.7` |

Express 5.3.0 е най-новият 5.x и държи `body-parser` на `^2.3.0`, затова lockfile е вдигнат вътре в range-а вместо с override. След express 5.3.0, multer 2.5.0, nodemailer 10.2.1 и махането на lead cap-а backend suite-ът минава.

### Timeout-и и пълни suite-ове

Първият пълен backend Jest след dependency upgrade-а, докато Grafana и Prometheus контейнерите още работеха: 870 passed, 17 skipped, 1 failed. Единственият неуспех е `tests/api/admin/cars.test.js` „returns cars list for admin“, default timeout 5s. Файлът сам: 20 passed за 1.823s. Вторият пълен Jest, след спиране на тези контейнери: 871 passed, 17 skipped, 0 failed, 63.812s. След logout поправката същият пълен Jest: 871 passed, 17 skipped, 0 failed, 57.652s.

Причината не е грешен assertion. `createApiTestApp` чисти require cache и зарежда отново API дървото; bcrypt в този тест е mock. При натоварен event loop първият такъв тест минава 5s. Timeout-ите и паралелността не са пипани.

DB consistency и integration са пуснати последователно само срещу `127.0.0.1:55432/luxride_test`: 17 passed и 77 passed, 0 failed, 0 skipped. Предишният `reservationRefund` `beforeAll` timeout от 5s не се повтори. `beforeAll` прави `createIntegrationTestApp` и `insertTestAdmin` с bcrypt cost 10 и се събира в 5s, когато suite-ът не дели CPU с друг Jest/Vitest и Docker.

Customer, последователно: ESLint 0 errors / 2 warnings, typecheck, Vitest 55 files / 183 passed / 0 failed, production build 1.05s. Предишните 15s timeout-и на SearchForm и FAQ не се повториха.

Admin, последователно: ESLint 0 errors / 4 warnings, typecheck, Vitest 60 files / 204 passed / 0 failed, production build 7.22s.

Backend ESLint преди последния Jest: 0 errors, 20 предишни warnings.

### E2E

Playwright 1.61.1, Chromium, `workers: 1`, `STRIPE_STUB=1`, `EMAIL_ENABLED=false`. Базата е изолираната `luxride_test` след 36 migrations. Няма реално плащане или имейл.

Първият пълен ход: 101 passed, 1 failed, 1 не е пуснат. Падна `admin-realtime` „Live SSE + car_returned“. Вторият EventSource получи `session_revoked` с reason `revoked` и изпусна събитието. Причината е `postLogout`: при 409 retry API клиентът прави logout и `hub.revokeUser` затваря всички stream-ове на потребителя, включително browser сесията. Поправката затваря само текущата сесия чрез `revokeSession`. Отнемането на роли продължава да вика `revokeUser`. Спецът след това: 2 passed. Auth и realtime unit тестовете след промяната: 25 passed.

Вторият пълен ход, след тази поправка: 101 passed, 1 failed, 1 не е пуснат. Падна `booking-stripe-cancel` с „Selected car is already reserved“. Същият тест в първия пълен ход мина за 2.4s. Checkout не намери hold за текущата сесия и видя чужд overlap. Не се възпроизведе.

Третият пълен ход: 103 passed, 0 failed, 0 skipped, 8.8m. Покрива регистрация, вход и изход, търсене, цена и резервация, stub checkout и потвърждение, customer ownership, staff права, админ обработка, документи, отказан text upload и SSE: `car_returned`, затваряне след logout и 403 за customer към staff stream.

### Grafana

Изолиран `grafana/grafana:13.2.4` на `127.0.0.1:13001`. Repo digest `sha256:dbbc38ea21103cefb50396340cd88afec779c7e070b0a7bf5a75b4ce46651d3f`. Health: database ok, version 13.2.4, commit `0e79aef9d91abf3bdadae9af15763029072fb45b`. Datasource uid `prometheus`. Provisioned dashboards: LuxRide API, Backend, Booking, Database, Payment, System Health. Prometheus query за `sum(rate(http_requests_total[1m])) * 60` върна 200, 1 frame, без error. CSP header е активен. Anonymous signup върна 401. Липсващите `plugins` и `alerting` директории дават лог, без да спират dashboards.

Това е празен volume, не upgrade на съществуващ Grafana 11.4 `grafana.db`. Официалната политика позволява директен upgrade между поддържани версии; 11.4 е извън поддръжка. Provisioning ползва uid `prometheus`, не numeric id. Production image pull, backup на стария volume и потвърждение срещу живия Prometheus остават deploy стъпки. Контейнерът е спрян и production не е променян.

### DB credentials и startup

Fresh `luxride`: schema плюс 36 migrations, после `ensureRuntimeRole`. `luxride_app` е `rolsuper/rolcreatedb/rolcreaterole/rolinherit = false`. Отнета е `receptionist` / `can_manage_contacts`. Повторен setup пропуска schema seed и не връща реда. API на port 3100 и worker на 3101 стартират само с runtime `DATABASE_URL`; след `dotenv` няма `MIGRATION_DATABASE_URL`, `APP_DB_PASSWORD` или `POSTGRES_PASSWORD`. И двата `/health/ready` са 200. `pg_stat_activity` по време на работата показва `luxride_app`. Login на синтетичен receptionist: 200, role `receptionist`, `can_view_orders` е наличен, отнетото `can_manage_contacts` липсва. `can_view_reservations_ops` за receptionist идва от schema 027 и не е отнеманото право. Driver grant остава 0. Migrations остават 36 след worker ready. Session ред през runtime ролята се записва и трие, защото login минава.

Entrypoint в Linux контейнер, с монтиран текущия скрипт: при `SKIP_DB_SETUP=true` чака runtime URL, пропуска setup и преди `exec` маха трите admin променливи. При setup пътя чака migration URL, пропуска вече засетия schema, ограничава ролята и пак маха променливите преди процеса. Worker compose няма отделен `APP_DB_PASSWORD`.

`luxride_test` е създадена на същия контейнер и минава същия setup: 36 migrations, driver grant 0.

### Rental horizon и action pins

Няма продуктов таван за колко рано може да е pickup: UI има само минимална дата, API и документацията не задават advance-booking максимум. Временните 2000 дни са махнати. Остава 366 таксувани дни, същият прозорец като analytics. Кратко наемане години напред е валидно. Период до `9999-12-31` се отхвърля от дължината. Границата минава през `validateBookingDates` за search, orders, reservations, checkout, admin pricing и availability, и през `listChargeDates`.

GitHub API на 2026-10-25, без стартиран workflow. И шестте pin-а съвпадат с официалния tag commit:

- `actions/checkout` v4 `11d5960a326750d5838078e36cf38b85af677262`
- `actions/setup-node` v4 `49933ea5288caeca8642d1e84afbd3f7d6820020`
- `actions/upload-artifact` v4 `ea165f8d65b6e75b540449e92b4886f43607fa02`
- `aws-actions/configure-aws-credentials` v4 `7474bc4690e29a8392af63c5b98e7449536d5c3a`
- `aws-actions/amazon-ecr-login` v2 `03f1aad4c6c7ffd436567f42f9384779290529bd`
- `gitleaks/gitleaks-action` v2 `ff98106e4c7b2bc287b24eaf42907196329070c7`

### Какво остава

Поправено в кода и проверено локално: advisories, rental cap, entrypoint credential split, logout SSE scope, Grafana compose CSP и loopback.

Проверено само на изолиран stack: Grafana 13.2.4 provisioning, API/worker с `luxride_app`, migration lifecycle, Playwright.

Чака production deploy: `APP_DB_PASSWORD` и `MIGRATION_DATABASE_URL` само за API; рестарт на API преди worker, за да мине migration 036; worker без migration URL; pull на Grafana 13.2.4 с digest pin, backup на съществуващия `grafana.db` и проверка срещу продукционния Prometheus. Еднократният checkout conflict не се повтори в чистия пълен E2E и няма отделна кодова промяна за него.

## Deployment стъпки

1. Задай `APP_DB_PASSWORD` (поне 16 знака) и `MIGRATION_DATABASE_URL` само за API. Паролата в URL трябва да е URL-encoded.
2. Рестартирай API преди worker. Migration `036` трябва да мине веднъж и да инвалидира driver сесиите.
3. Не слагай migration URL в средата на worker. `SKIP_DB_SETUP=true` вече е в compose.
4. Production Grafana: backup на съществуващия `grafana.db`, pull на `grafana/grafana:13.2.4` и сравни с локално видения digest `sha256:dbbc38ea21103cefb50396340cd88afec779c7e070b0a7bf5a75b4ce46651d3f`. Изолираният празен volume вече зарежда dashboards и CSP.
5. Action SHA-тата съвпадат с официалните tag commit-и от 2026-10-25. Повтори сверката преди следващия privileged workflow, защото tag-овете могат да се преместят.
6. `body-parser`, `multer`, `nodemailer`, `undici` и `zod` са обновени локално и `npm audit` е чист. Production образите трябва да се build-нат от този lockfile.
