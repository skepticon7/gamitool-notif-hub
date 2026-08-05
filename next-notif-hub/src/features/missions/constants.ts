export const MISSIONS_QUERY_KEY = ['admin', 'missions'] as const;

export const myAssignmentsQueryKey = (status?: string) =>
    ['employee', 'missions', 'my-assignments', status ?? 'all'] as const;

export const LATEST_ASSIGNMENTS_QUERY_KEY = ['employee', 'missions', 'assignments', 'latest'] as const;
