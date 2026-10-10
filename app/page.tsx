import { cookies, headers } from "next/headers";
import { I18nProvider } from "@/lib/components/i18n";
import { OrbitApp } from "@/lib/components/orbit-app";
import { LANG_COOKIE, resolveLang } from "@/lib/assets/i18n";

export default async function Home() {
  // Resolved on the server so the HTML already arrives in the right language.
  const lang = resolveLang(
    (await cookies()).get(LANG_COOKIE)?.value,
    (await headers()).get("accept-language"),
  );
  return (
    <I18nProvider initialLang={lang}>
      <OrbitApp />
    </I18nProvider>
  );
}
