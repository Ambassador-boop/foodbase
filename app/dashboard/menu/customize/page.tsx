import { Suspense } from "react";
import CustomizeMenuPage from "./CustomizeMenuPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8">Loading...</div>}>
      <CustomizeMenuPage />
    </Suspense>
  );
}