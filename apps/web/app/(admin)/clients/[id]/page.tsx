import { ClientDetails } from "@/components/client-details"

export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ClientDetails id={id} />
}
