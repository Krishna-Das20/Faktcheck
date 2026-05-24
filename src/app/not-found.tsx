import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="page-shell flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-8xl font-extrabold text-primary-500 mb-4 drop-shadow-[0_0_24px_rgba(255,107,53,0.2)]">
          404
        </h1>
        <p className="text-strong text-xl font-semibold mb-2">
          Page Not Found
        </p>
        <p className="text-muted-ui text-sm mb-8">
          The page you are looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="btn-primary inline-flex items-center gap-2 px-6 py-3"
        >
          Go Home
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
