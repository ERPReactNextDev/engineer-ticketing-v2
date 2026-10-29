const TERMINAL_JOB_REQUEST_STATUSES = new Set(["COMPLETED", "CANCELLED", "DONE"])

export function needsJobRequestAttention(statusValue: unknown, departmentValue: unknown, roleValue: unknown): boolean {
    const status = typeof statusValue === "string" ? statusValue.toUpperCase().trim() : ""
    const department = typeof departmentValue === "string" ? departmentValue.toUpperCase().trim() : ""
    const role = typeof roleValue === "string" ? roleValue.toUpperCase().trim() : ""

    if (!status || TERMINAL_JOB_REQUEST_STATUSES.has(status)) return false

    const isEngineering = department === "ENGINEERING" || department === "IT"
    const isSales = department === "SALES"
    const isProcurement = department === "PROCUREMENT"
    const isManager = ["SUPER ADMIN", "MANAGER", "LEADER"].includes(role)
    const needsEngineering = status.includes("ASSIGNED") || status.includes("PROGRESS") || status.includes("APPROVED")
    const needsSales = status === "PENDING" || status.includes("SUBMITTED") || status.includes("AWAITING")
    const needsProcurement = status === "JR FORM FORWARD TO PROCUREMENT"

    return isManager ||
        (isEngineering && needsEngineering) ||
        (isSales && needsSales) ||
        (isProcurement && needsProcurement)
}
