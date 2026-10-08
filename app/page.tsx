import { PortiaDesktop } from "@/components/portia-desktop";
import { defaultPortiaContent } from "@/lib/portia-content";

export default function Home() {
  return <PortiaDesktop initialContent={defaultPortiaContent} />;
}
