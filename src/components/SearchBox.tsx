"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { NetworkId } from "@/lib/chains";

export function SearchBox({ network, large = false }: { network: NetworkId; large?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    if (/^0x[0-9a-fA-F]{40}$/.test(v)) router.push(`/${network}/delegator/${v.toLowerCase()}`);
    else if (/^\d+$/.test(v)) router.push(`/${network}/validator/${v}`);
    else if (v) router.push(`/${network}?q=${encodeURIComponent(v)}`);
  }
  return (
    <form onSubmit={submit} className={large ? "w-full" : "hidden md:block"}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={large ? "Delegator address (0x…), validator id or name" : "Address, validator id or name"}
        className={`rounded-md border border-line bg-bg px-3 text-sm outline-none focus:border-accent ${large ? "w-full py-3" : "w-72 py-1.5"}`}
      />
    </form>
  );
}
