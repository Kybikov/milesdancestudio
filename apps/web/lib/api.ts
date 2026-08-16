const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message)
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new ApiError(
      data.message ?? "Не вдалося виконати операцію",
      response.status,
      data
    )
  return data as T
}

export type SessionUser = {
  id: string
  email: string
  displayName: string
  avatarPath: string | null
  mustChangePassword: boolean
  teacherId: string | null
  roles: string[]
  permissions: string[]
}
