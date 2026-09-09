import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { SearchBox } from "@/components/SearchBox";
import { isNetworkId } from "@/lib/chains";

export const metadata: Metadata = { title: "Delegator lookup" };

export default async function DelegatorIndex({ params }: { params: Promise<{ network: string }> }) {
  const { network } = await params;
  if (!isNetworkId(network)) notFound();
  return (
    <>
      <Header network={network} active="delegator" />
      <main className="mx-auto w-full max-w-3xl px-4 py-16">
        <h1 className="text-2xl font-semibold">Delegator lookup</h1>
        <p className="mt-2 text-sm text-muted">
          Enter a wallet address to see every validator it delegates to, active and pending stake, unclaimed rewards and withdrawal requests.
        </p>
        <div className="mt-6"><SearchBox network={network} large /></div>
      </main>
    </>
  );
}
