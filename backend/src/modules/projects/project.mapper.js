function summarizeEndpoints(endpoints) {
  const active = endpoints.filter((endpoint) => endpoint.status === "ACTIVE");
  const counts = {
    total: endpoints.length,
    active: active.length,
    paused: endpoints.length - active.length,
    up: endpoints.filter((endpoint) => endpoint.isUp === true).length,
    down: endpoints.filter((endpoint) => endpoint.isUp === false).length,
    unknown: endpoints.filter((endpoint) => endpoint.isUp === null).length,
  };

  let health = "EMPTY";
  if (endpoints.length > 0 && active.length === 0) health = "PAUSED";
  else if (active.some((endpoint) => endpoint.isUp === false)) health = "DOWN";
  else if (active.length > 0 && active.every((endpoint) => endpoint.isUp === true)) health = "UP";
  else if (active.length > 0) health = "UNKNOWN";

  const checkedTimes = endpoints
    .map((endpoint) => endpoint.lastCheckedAt)
    .filter(Boolean)
    .map((value) => value.getTime());

  return {
    health,
    endpointCounts: counts,
    lastCheckedAt: checkedTimes.length ? new Date(Math.max(...checkedTimes)) : null,
  };
}

export function mapProject(project) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    ...summarizeEndpoints(project.monitors ?? []),
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
