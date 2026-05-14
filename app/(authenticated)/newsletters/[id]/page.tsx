import { redirect } from "next/navigation";

export default async function LegacyNewsletterDetailRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/library?article=${encodeURIComponent(id)}`);
}
