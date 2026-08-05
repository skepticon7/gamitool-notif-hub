# Prompt for the nest-notif-hub backend session

Paste everything below the line into the Claude session working in `nest-notif-hub`.

---

Add a `GET /employees/me` endpoint so an employee can read their own `xp`/`level` — needed for the frontend's profile drawer, which currently can't show Level/Total XP at all because no employee-scoped read exists for it.

Context I already traced in the code, so build on it rather than re-discovering:

- `xp: number` and `level: number` already exist as real columns on `EmployeeUserEntity` (`src/users/entities/employee-user.entity.ts`) — the data is there, nothing to add to the schema.
- The only place that currently reads them is `GetAllEmployeesHandler` (`src/users/handlers/query-handlers/get-all-employees.handler.ts`), used by `GET /admin/accounts/employees` (`src/admin/controllers/accounts.controller.ts`) — that route is `@Roles('admin')`-gated and returns *every* employee, not scoped to "me." An employee JWT can't call it at all.
- The "derive the caller's own record from the JWT, never from a URL param" pattern already exists elsewhere and should be mirrored here — see `MissionsController.myAssignments()` (`src/missions/missions.controller.ts`), which reads `req.user.userId` directly rather than taking an `:id` param. Same reasoning applies: this stops one employee reading another's XP by guessing an id.
- Since `UserEntity` uses Single Table Inheritance (`src/users/entities/user.entity.ts` — admins and employees are the same physical `users` row, discriminated by a `role` column), an employee's JWT `userId` *is* their `EmployeeUserEntity.id` directly — no join or lookup-by-`sub` needed, just `employeeUserRepository.findOneBy({ id: req.user.userId })`.

Implement, following the existing CQRS query/handler pattern (matching `GetAllEmployeesQuery`/`GetAllEmployeesHandler`'s shape, not a plain service call):

1. **`src/users/queries/get-my-employee-profile.query.ts`**
   ```ts
   export class GetMyEmployeeProfileQuery {
     constructor(public readonly employeeId: string) {}
   }
   ```

2. **`src/users/handlers/query-handlers/get-my-employee-profile.handler.ts`** — `@InjectRepository(EmployeeUserEntity)`, `findOneBy({ id: query.employeeId })`. Decide what happens if the row is somehow missing (shouldn't be possible for a valid employee JWT, but don't assume — check what `resolveUser`-style guards elsewhere in this codebase do, e.g. `AuthService.resolveUser`'s `ACCOUNT_NOT_PROVISIONED` `BusinessException`, and follow the same convention rather than inventing a new error shape).

3. **New `src/users/employees.controller.ts`** (there's currently no non-admin employee-facing controller in this module — `AccountsController` is entirely `@Roles('admin')`, so this needs to be a new file, not an addition to it):
   ```ts
   @Controller('employees')
   @UseGuards(JwtAuthGuard)
   export class EmployeesController {
     constructor(private readonly queryBus: QueryBus) {}

     @Get('me')
     me(@Req() req: { user: AppJwtPayload }) {
       return this.queryBus.execute(new GetMyEmployeeProfileQuery(req.user.userId));
     }
   }
   ```
   No `RolesGuard`/`@Roles(...)` — any authenticated user can read their own profile (an admin JWT calling this would just get `xp`/`level` as `null`, which is fine and expected per the entity's own comment: "these columns only mean something for employee rows").

4. Register `EmployeesController` + the new query handler in `UsersModule` (`src/users/users.module.ts`) — add the controller to a `controllers: [...]` array (doesn't currently have one) and the handler to the existing `QueryHandlers` array.

Response shape the frontend needs: `{ xp: number | null, level: number | null }` at minimum — whether you return the full `EmployeeUserEntity` (like `GetAllEmployeesHandler` does) or a narrower DTO is your call, but confirm which one back to me since the frontend needs to know the exact shape to type against.
