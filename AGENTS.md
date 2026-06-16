# AGENTS.md

Two-package split-stack repo. No monorepo orchestration. Packages are fully independent and communicate over HTTP at runtime.

| Package | Dir | Stack |
|---|---|---|
| Frontend | `client/` | TypeScript, SvelteKit 2, Svelte 5, Vite 7, Tailwind CSS 4 |
| Backend | `server/` | Java 25, Spring Boot 4.1.0-M1, Gradle 9.3.1 (Kotlin DSL) |

## Toolchain setup

Versions are pinned via **mise** (`mise.toml` at root):

```
java = "temurin-25"
bun  = "1.3.0"
node = "22.20.0"
```

Run `mise install` before anything else. `mise` also injects `SERVER_PORT=8080` and `SPRING_PROFILES_ACTIVE=dev` into the shell environment automatically.

## Client (`client/`)

**Package manager: Bun.** Both `bun.lock` and `package-lock.json` exist — ignore `package-lock.json`, always use `bun`.

```bash
bun install             # install dependencies
bun run dev             # dev server (http://localhost:5173)
bun run build           # production build
bun run check           # svelte-check type-check (once)
bun run check:watch     # type-check in watch mode
```

**No linter or formatter** — no ESLint, Prettier, or Biome config exists. Type checking is the only static analysis.

### OpenAPI code generation

`src/lib/types/api.d.ts` is **generated** — never edit it manually.

```bash
bun run sync:api        # start server, download spec, generate types (all-in-one)
bun run download:api    # only download spec from running server -> server/openapi.json
bun run generate:api    # only generate types from server/openapi.json -> src/lib/types/api.d.ts
```

`sync:api` starts the backend automatically (via `scripts/openapi-sync.sh`). Run it from `client/`. The backend must be reachable for `download:api`.

### Environment variables (optional)

Defaults work for local dev without a `.env` file:

| Variable | Default |
|---|---|
| `VITE_SERVER_BASE_URL` | `http://localhost:8080` |
| `VITE_API_USERNAME` | `user` |
| `VITE_API_PASSWORD` | `password` |

## Server (`server/`)

All Gradle commands run from `server/` using the wrapper.

```bash
./gradlew bootRun               # start dev server (port 8080)
./gradlew build                 # compile + test + quality checks
./gradlew test                  # run all tests
./gradlew test --tests "dev.ilionx.workshop.api.vet.controller.VetControllerTest"  # single class
./gradlew test --tests "dev.ilionx.workshop.api.vet.controller.VetControllerTest.methodName"  # single method
./gradlew spotlessApply         # apply Java formatter
./gradlew spotlessCheck         # check formatting only
./gradlew check                 # all quality checks (Checkstyle, PMD, SpotBugs, Spotless)
```

### Critical build quirks

- **`spotlessApply` runs on every compile** — `tasks.withType<JavaCompile>` declares `dependsOn("spotlessApply")`. Any `bootRun`, `build`, or `test` invocation reformats Java sources first. Do not fight this; ensure code is formattable before invoking Gradle.
- **`-Werror` on all Java compile tasks** — all `-Xlint:all` warnings (except `-serial`, `-processing`, `-this-escape`) are compile errors. New code must be lint-clean to compile.
- **`mavenLocal()` is a dependency repository** — local Maven cache is consulted before Maven Central.

### Spring profiles

| Profile | Activated by | DB behavior |
|---|---|---|
| `dev` | default (set by `mise`) | Liquibase drops + recreates DB; loads seed data (`tst` context) |
| `test` | `@ActiveProfiles("test")` in tests | Separate H2 `testdb`; loads seed data (`tst` context) |
| `prd` | not used locally | Schema only, no seed data |

Database is H2 in-memory — no external DB needed.

### API structure

- Servlet context path: `/api` — all endpoints are under `http://localhost:8080/api/…`
- Auth: HTTP Basic — dev credentials `user` / `password`
- OpenAPI spec: `GET /api/v1/public/docs`
- Health: `GET /api/v1/public/actuator/health`
- CORS: `http://localhost:*` allowed (wildcard port)
- **Test profile overrides context path to `""`** — MockMvc test URLs omit `/api` prefix.

### Quality config locations

All in `server/src/quality/config/`:
- Spotless style: `spotless/styling.xml`
- Checkstyle: `checkstyle/checkstyle.xml`
- PMD: `pmd/pmd.xml`
- CodeNarc: `codenarc/codenarc.xml`

### Test infrastructure

- Unit tests extend `UnitTest` (`@ExtendWith(MockitoExtension.class)`)
- Integration tests extend `IntegrationTest` (`@SpringBootTest(webEnvironment = RANDOM_PORT)`, `@ActiveProfiles("test")`)
- `IntegrationTest` runs `cleanDatabase()` before/after each test — deletes rows with ID > 6 for vets/pet-types/specialties to preserve seed data. Do not rely on IDs ≤ 6 being available for newly created test data.

### DTO mappers (MapStruct)

MapStruct `1.6.3` is used for entity → response DTO conversion. All mappers share a common config from the external library `starter-core` (`io.github.jframe.util.mapper.config.SharedMapperConfig`), which sets:
- `componentModel = "spring"` — generated impl is a Spring `@Component`, injectable via constructor
- `unmappedTargetPolicy = IGNORE` — unmatched target fields are silently left null; no compile warning
- `injectionStrategy = CONSTRUCTOR` — consistent with `@RequiredArgsConstructor` style used throughout

**Mappers are `abstract class`, not `interface`** — this allows concrete method overrides alongside MapStruct-generated abstract methods.

**Request → entity mapping is manual in the service layer. Mappers only handle entity → response DTO**, called in the controller layer:

```java
// Controller owns the mapper; service returns entity; mapper converts at the boundary
Vet vet = vetService.create(request);           // request passed raw to service
return ResponseEntity.ok(vetMapper.toResponse(vet));
```

**Directory layout:** mappers live at `<domain>/model/mapper/` alongside entities, `request/`, and `response/` dirs.

**Naming conventions:**
- Mapper: `<Domain>Mapper`
- Primary response: `<Domain>Response`
- Lightweight nested embed: `<Domain>SummaryResponse`
- Request DTOs: `Create<Domain>Request` / `Update<Domain>Request`
- Mapper methods: `toResponse(Entity)`, `toResponseList(List<Entity>)`

**Non-obvious patterns to replicate:**

1. **Nested FK flattening** — use `@Mapping(source, target)` to promote a nested scalar to a top-level DTO field:
   ```java
   @Mapping(source = "owner.id", target = "ownerId")
   public abstract PetResponse toResponse(Pet pet);
   ```

2. **`Set` → sorted `List` — write a concrete method**; MapStruct auto-generates `List → List` but not `Set → List`. Example in `VetMapper`:
   ```java
   public List<SpecialtyResponse> toSpecialtyResponseList(final Set<Specialty> specialties) {
       return specialties.stream()
           .sorted((a, b) -> Integer.compare(a.getId(), b.getId()))
           .map(this::toSpecialtyResponse)
           .collect(Collectors.toList());
   }
   ```
   MapStruct will invoke this concrete method automatically when generating the parent `toResponse(Vet)` mapping.

3. **Cross-domain mappings on one mapper** — a mapper may include methods for a sub-entity if the parent response embeds it (e.g., `VetMapper` also maps `Specialty → SpecialtyResponse` to handle the embedded list).

**No test-specific mapper stubs or mocks exist.** The real Spring beans are available in `@ActiveProfiles("test")` integration tests.

### Logging

| Env var | Default | Options |
|---|---|---|
| `LOG_APPENDER` | `HUMANREADABLE` | `LOGSTASHENCODER` (JSON) |
| `APPLICATION_LOG_LEVEL` | `DEBUG` | any SLF4J level |
| `ROOT_LOG_LEVEL` | `INFO` | any SLF4J level |

## Dev setup sequence

```bash
mise install                   # 1. install toolchain

cd client && bun install       # 2. install frontend deps

# Terminal A — backend
cd server && ./gradlew bootRun # 3. start backend (wait for "Started Application")

# Terminal B — frontend
cd client && bun run dev       # 4. start frontend (http://localhost:5173)

# Optional: regenerate API types after backend changes
cd client && bun run sync:api
```

Backend log during `sync:api` goes to `/tmp/petclinic-backend.log`.
