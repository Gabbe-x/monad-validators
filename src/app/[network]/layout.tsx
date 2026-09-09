import { notFound } from "next/navigation";
import { isNetworkId } from "@/lib/chains";
import { Footer } from "@/components/ui";

export default async function NetworkLayout({ children, params }: { children: React.ReactNode; params: Promise<{ network: string }> }) {
  const { network } = await params;
  if (!isNetworkId(network)) notFound();
  return (
    <>
      {children}
      <Footer />
    </>
  );
}
