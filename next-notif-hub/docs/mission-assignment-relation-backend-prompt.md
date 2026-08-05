# Prompt for the nest-notif-hub backend session

Paste everything below the line into the Claude session working in `nest-notif-hub`.

---

`GET /missions/my-assignments` needs to return each assignment's mission `name`/`xpGranted`/`durationDays` embedded, not just `missionId`. The frontend's employee dashboard "Active missions" panel needs to show the mission's name, XP value, and deadline per row — right now there's no way to resolve `missionId` into any of that, since there's no employee-readable mission catalog endpoint and the assignment row itself doesn't carry it.

Context already traced in the code:

- `GetMyMissionAssignmentsHandler` (`src/missions/handlers/get-my-mission-assignments.handler.ts`) currently does:
  ```ts
  return this.repo.find({
    where: { ...buildAssignmentWhere(query), employeeId: query.employeeId },
  });
  ```
  No `relations` option — TypeORM doesn't eager-load `MissionAssignmentEntity.mission` by default, so the response is bare scalar columns only (`id, missionId, employeeId, status, assignedAt, completedAt, deadline`).
- `MissionAssignmentEntity` (`src/missions/entities/mission-assignment.entity.ts`) already has the relation defined: `@ManyToOne(() => MissionEntity) @JoinColumn({name: 'missionId'}) mission: MissionEntity`. The relation exists, it's just never requested.
- `MissionEntity` (`src/missions/entities/mission.entity.ts`) has `name`, `xpGranted`, `durationDays` — everything the dashboard needs.

Fix: add `relations: ['mission']` to that `.find()` call:
```ts
return this.repo.find({
  where: { ...buildAssignmentWhere(query), employeeId: query.employeeId },
  relations: ['mission'],
});
```

That's the whole change — no new endpoint, no new query/handler, this one route just needs to eager-load a relation it already has defined. The response shape becomes `{ id, missionId, employeeId, status, assignedAt, completedAt, deadline, mission: { id, name, xpGranted, durationDays, createdAt, updatedAt } }`.

One thing to double check rather than assume: `GetMyMissionAssignmentsHandler` has `@CacheableQuery(300)` on `execute()` — confirm that decorator caches by query params (and thus won't return a stale pre-relation-fix cached response, or serve one employee's cached result to another) before treating this as done. Also worth a quick check that `MissionsController.myAssignments()`'s response isn't stripped back down to scalars anywhere between the handler and the HTTP response (e.g. a serialization/interceptor step) — if so, the embedded `mission` object could get silently dropped.
