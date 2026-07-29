const TEMPLATE_FIELD_PATTERN = /{{\s*(\w+)\s*}}/g;

// Replaces {{field}} tokens with values from `data`. An unresolved token
// (field not present in data) renders as an empty string rather than
// leaving the literal "{{field}}" in the delivered message — the
// EventLinkGraphValidator check (see extractTemplateFields) is what's
// supposed to stop that case from ever reaching here.
export function interpolateTemplate(template: string, data: Record<string, any>): string {
  return template.replace(TEMPLATE_FIELD_PATTERN, (_match, key: string) => {
    const value = data[key];
    return value !== undefined && value !== null ? String(value) : '';
  });
}

// Every {{field}} token a template references — used at wiring time to
// check each one is actually available for the event it's being wired to.
export function extractTemplateFields(template: string): string[] {
  return [...template.matchAll(TEMPLATE_FIELD_PATTERN)].map((match) => match[1]);
}
