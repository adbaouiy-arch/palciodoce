import { requireAdmin } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/admin-shell";
import { listContactMessages } from "@/lib/data/admin";
import { formatDateTime } from "@/lib/format-date";
import { LOCALE_PT } from "@/lib/admin-labels";
import { setMessageHandledAction } from "@/app/admin/actions";

export default async function AdminMessagesPage() {
  const session = await requireAdmin();
  const messages = await listContactMessages();

  const pending = messages.filter((message) => !message.isHandled).length;

  return (
    <AdminShell
      session={session}
      activeHref="/admin/messages"
      title="Mensagens"
      description={`${messages.length} mensagens · ${pending} por tratar. Responda no idioma em que o cliente escreveu.`}
    >
      {messages.length === 0 ? (
        <p className="rounded-xl border border-line bg-paper p-8 text-center text-cocoa-soft">
          Ainda não há mensagens.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {messages.map((message) => (
            <li
              key={message.id}
              className={`rounded-xl border p-6 ${
                message.isHandled
                  ? "border-line bg-cream-dark/50"
                  : "border-gold/40 bg-paper"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-cocoa">{message.name}</p>
                  <a
                    href={`mailto:${message.email}`}
                    dir="ltr"
                    className="text-sm text-cocoa-soft underline underline-offset-4 hover:text-cocoa focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    {message.email}
                  </a>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-line bg-cream px-2.5 py-1 text-cocoa-soft">
                    {LOCALE_PT[message.locale]}
                  </span>
                  <span className="text-cocoa-soft" dir="ltr">
                    {formatDateTime(message.createdAt, "pt")}
                  </span>
                  {message.isHandled ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-900">
                      Tratada
                    </span>
                  ) : (
                    <span className="rounded-full border border-gold/50 bg-gold/15 px-2.5 py-1 font-medium text-cocoa">
                      Por tratar
                    </span>
                  )}
                </div>
              </div>

              <p
                className="mt-4 whitespace-pre-line text-sm leading-relaxed text-cocoa-soft"
                dir={message.locale === "ar" ? "rtl" : "ltr"}
              >
                {message.message}
              </p>

              <form action={setMessageHandledAction} className="mt-4">
                <input type="hidden" name="id" value={message.id} />
                <input
                  type="hidden"
                  name="isHandled"
                  value={message.isHandled ? "false" : "true"}
                />
                <button
                  type="submit"
                  className="rounded-full border border-cocoa px-4 py-2 text-sm font-medium text-cocoa transition-colors hover:bg-cream-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  {message.isHandled
                    ? "Marcar como por tratar"
                    : "Marcar como tratada"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
