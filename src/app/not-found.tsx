import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold">Not found</h1>
      <p className="mt-3 text-muted">That validator, address or page does not exist.</p>
      <Link href="/mainnet" className="mt-6 inline-block rounded-md bg-accent px-4 py-2 text-white">Back to validators</Link>
    </main>
  );
}
