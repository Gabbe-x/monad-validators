import Link from "next/link";
import { NETWORKS, type NetworkId } from "@/lib/chains";
import { SearchBox } from "./SearchBox";

export function Header({ network, active }: { network: NetworkId; active: "validators" | "epoch" | "delegator" | "api" }) {
  const nav: { key: typeof active; label: string; href: string }[] = [
    { key: "validators", label: "Validators", href: `/${network}` },
    { key: "epoch", label: "Epoch & set changes", href: `/${network}/epoch` },
    { key: "delegator", label: "Delegator lookup", href: `/${network}/delegator` },
    { key: "api", label: "API", href: `/${network}/api` },
  ];
  return (
    <header className="border-b border-line bg-panel/60 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href={`/${network}`} className="flex items-center gap-2 font-semibold text-lg">
          <span className="inline-block h-6 w-6 rounded-md bg-accent" aria-hidden />
          Monad Validators
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {nav.map((n) => (
            <Link
              key={n.key}
              href={n.href}
              className={`rounded-md px-3 py-1.5 transition-colors ${active === n.key ? "bg-accent/20 text-accent-2" : "text-muted hover:text-fg hover:bg-panel-2"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <SearchBox network={network} />
          <div className="flex rounded-md border border-line overflow-hidden text-sm">
            {(Object.keys(NETWORKS) as NetworkId[]).map((id) => (
              <Link
                key={id}
                href={`/${id}`}
                className={`px-3 py-1.5 ${id === network ? "bg-accent text-white" : "text-muted hover:bg-panel-2"}`}
              >
                {id === "mainnet" ? "Mainnet" : "Testnet"}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}
