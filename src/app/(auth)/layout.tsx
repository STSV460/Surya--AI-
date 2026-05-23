import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
