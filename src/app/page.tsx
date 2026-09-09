import { redirect } from "next/navigation";
import { DEFAULT_NETWORK } from "@/lib/chains";

export default function Home() {
  redirect(`/${DEFAULT_NETWORK}`);
}
