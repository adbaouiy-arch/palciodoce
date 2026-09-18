import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { LoginForm } from "./login-form";

export default async function AdminLoginPage() {
  // Already signed in? Skip the form.
  const session = await getAdminSession();
  if (session) {
    redirect("/admin");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <p className="font-heading text-2xl font-semibold text-cocoa">
            Palácio Doce
          </p>
          <h1 className="mt-1 text-sm font-medium uppercase tracking-wide text-cocoa-soft">
            Área de Gestão
          </h1>
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-paper p-7 shadow-sm">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-cocoa-soft">
          Acesso restrito à equipa do Palácio Doce.
        </p>
      </div>
    </main>
  );
}
