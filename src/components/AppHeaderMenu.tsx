"use client";

import Link from "next/link";
import { CircleUserRound, MoreVertical } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { isLang } from "@/lib/i18n/dictionary";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function AppHeaderMenu() {
  const { lang, setLang, t, dir } = useI18n();
  return (
    <DropdownMenu dir={dir}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("appMenu")}
          className="grid size-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-primary sm:hidden"
        >
          <MoreVertical className="size-5" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuItem asChild className="min-h-11">
          <Link href="/account">
            <CircleUserRound aria-hidden="true" />
            {t("authAccount")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("appLanguage")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={lang}
          onValueChange={(value) => {
            if (isLang(value)) setLang(value);
          }}
          aria-label={t("appLanguage")}
        >
          <DropdownMenuRadioItem value="he" className="min-h-11">
            <span lang="he" dir="rtl">
              {t("languageHebrew")}
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="en" className="min-h-11">
            <span lang="en" dir="ltr">
              {t("languageEnglish")}
            </span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="ru" className="min-h-11">
            <span lang="ru" dir="ltr">
              {t("languageRussian")}
            </span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
