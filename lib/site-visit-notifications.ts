export function needsSiteVisitAttention(
  statusValue: unknown,
  departmentValue: unknown,
  roleValue: unknown
): boolean {
  const status = typeof statusValue === "string" ? statusValue.toUpperCase().trim() : ""
  const department = typeof departmentValue === "string" ? departmentValue.toUpperCase().trim() : ""
  const role = typeof roleValue === "string" ? roleValue.toUpperCase().trim() : ""

  if (status === "PENDING") return department === "ENGINEERING" || department === "IT"
  if (status !== "CONFIRMED" || department !== "SALES") return false

  return role.includes("MANAGER") || role.includes("SALES HEAD") || role === "TSM" || role === "SUPER ADMIN"
}
