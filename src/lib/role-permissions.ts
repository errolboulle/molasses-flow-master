export function rolePermissions(roles: readonly string[]) {
  const isSupervisor = roles.includes("supervisor");
  return { isSupervisor, isAdmin: !isSupervisor && roles.includes("admin"), isOperator: !isSupervisor && roles.includes("operator"), canEntry: !isSupervisor && (roles.includes("admin") || roles.includes("operator")), canExportReports: roles.length > 0 };
}
