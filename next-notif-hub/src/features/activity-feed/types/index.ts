// `_id`, not `id` — confirmed against the actual Mongo schema
// (ActivityFeedEntry._id in nest-notif-hub), which CLAUDE.md's documented
// `{ id, eventType, message, occurredOn }` shape doesn't match. Worth
// re-confirming against a real response if this ever looks wrong.
export interface ActivityFeedEntry {
    _id: string;
    eventType: string;
    message: string;
    occurredOn: string;
}
